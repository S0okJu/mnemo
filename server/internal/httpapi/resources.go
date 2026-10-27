package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"mnemo/server/internal/collection"
)

type Events struct {
	Heartbeat      time.Duration
	QueueSize      int
	MaxSubscribers int
	mu             sync.Mutex
	subscribers    map[chan struct{}]struct{}
}

func (e *Events) Notify() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for ch := range e.subscribers {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
func (e *Events) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		write(w, 500, nil)
		return
	}
	queueSize := e.QueueSize
	if queueSize <= 0 {
		queueSize = 1
	}
	maxSubscribers := e.MaxSubscribers
	if maxSubscribers <= 0 {
		maxSubscribers = 256
	}
	heartbeat := e.Heartbeat
	if heartbeat <= 0 {
		heartbeat = 15 * time.Second
	}
	ch := make(chan struct{}, queueSize)
	e.mu.Lock()
	if e.subscribers == nil {
		e.subscribers = map[chan struct{}]struct{}{}
	}
	if len(e.subscribers) >= maxSubscribers {
		e.mu.Unlock()
		write(w, 503, nil)
		return
	}
	e.subscribers[ch] = struct{}{}
	e.mu.Unlock()
	defer func() { e.mu.Lock(); delete(e.subscribers, ch); e.mu.Unlock() }()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	controller := http.NewResponseController(w)
	send := func(frame string) bool {
		_ = controller.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if _, err := fmt.Fprint(w, frame); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}
	if !send("event: refresh\ndata: {}\n\n") {
		return
	}
	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ch:
			if !send("event: refresh\ndata: {}\n\n") {
				return
			}
		case <-ticker.C:
			if !send(": heartbeat\n\n") {
				return
			}
		}
	}
}
func (a *API) resources(w http.ResponseWriter, r *http.Request) {
	m, _, generation, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	if !m.Configured {
		write(w, 409, map[string]string{"reason": "not-configured", "message": "No cluster connected."})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/")
	var matched *collection.Kind
	var suffix string
	for i := range collection.Kinds {
		k := &collection.Kinds[i]
		if path == k.Path || strings.HasPrefix(path, k.Path+"/") {
			matched = k
			suffix = strings.TrimPrefix(strings.TrimPrefix(path, k.Path), "/")
			break
		}
	}
	if matched == nil {
		write(w, 404, map[string]string{"message": "Resource kind is not supported."})
		return
	}
	var stale, initialized bool
	var problem *string
	err = a.Store.Pool.QueryRow(r.Context(), "SELECT stale OR last_success_at < now()-interval '60 seconds',initialized,error FROM sync_states WHERE connection_id=1 AND generation=$1 AND kind=$2", generation, matched.Name).Scan(&stale, &initialized, &problem)
	if problem != nil && *problem == "forbidden" {
		write(w, 403, map[string]string{"message": "Cluster read permission denied."})
		return
	}
	if err != nil || !initialized || problem != nil {
		write(w, 503, map[string]string{"message": "Resource collection is unavailable or initializing."})
		return
	}
	if stale {
		w.Header().Set("X-Mnemo-Stale", "true")
	}
	namespace := r.URL.Query().Get("namespace")
	search := r.URL.Query().Get("search")
	where := ` FROM resources WHERE connection_id=1 AND generation=$1 AND kind=$2 AND deleted_at IS NULL AND ($3='' OR namespace=$3) AND ($4='' OR strpos(lower(name),lower($4))>0) AND EXISTS(SELECT 1 FROM cluster_connections c WHERE c.id=1 AND c.generation=$1 AND (c.metadata->>'configured')::boolean)`
	if suffix != "" {
		parts := strings.Split(suffix, "/")
		if len(parts) != 2 && len(parts) != 3 {
			write(w, 404, nil)
			return
		}
		namespace = parts[0]
		if namespace == "_" {
			namespace = ""
		}
		var data json.RawMessage
		err = a.Store.Pool.QueryRow(r.Context(), "SELECT data"+where+" AND namespace=$5 AND name=$6", generation, matched.Name, "", "", namespace, parts[1]).Scan(&data)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				write(w, 404, map[string]string{"message": "Resource not found."})
			} else {
				write(w, 503, map[string]string{"message": "Database unavailable."})
			}
			return
		}
		if len(parts) == 3 {
			a.subresource(w, r, *matched, namespace, parts[1], parts[2], generation, data)
			return
		}
		write(w, 200, data)
		return
	}
	limit := 100
	offset := 0
	for key, target := range map[string]*int{"limit": &limit, "offset": &offset} {
		if value := r.URL.Query().Get(key); value != "" {
			parsed, e := strconv.Atoi(value)
			if e != nil || parsed < 0 {
				write(w, 400, map[string]string{"message": "Invalid pagination."})
				return
			}
			*target = parsed
		}
	}
	if limit < 1 || limit > 500 {
		write(w, 400, map[string]string{"message": "Limit must be 1..500."})
		return
	}
	// Count and page share a single PostgreSQL snapshot and generation predicate.
	queryStarted := time.Now()
	defer func() { resourceDuration.Add(int64(time.Since(queryStarted))); resourceRequests.Add(1) }()
	rows, err := a.Store.Pool.Query(r.Context(), "WITH filtered AS (SELECT data,name,namespace,uid"+where+") SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(page.data ORDER BY page.namespace,page.name,page.uid) FROM (SELECT * FROM filtered ORDER BY namespace,name,uid LIMIT $5 OFFSET $6) page),'[]'::jsonb)", generation, matched.Name, namespace, search, limit, offset)
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	defer rows.Close()
	if rows.Next() {
		var total int
		var items json.RawMessage
		if rows.Scan(&total, &items) != nil {
			write(w, 503, nil)
			return
		}
		write(w, 200, map[string]any{"items": items, "total": total})
		return
	}
	write(w, 503, nil)
}
