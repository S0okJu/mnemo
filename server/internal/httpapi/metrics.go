package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"mnemo/server/internal/collection"
)

var resourceDuration atomic.Int64
var resourceRequests atomic.Uint64

func (a *API) metrics(w http.ResponseWriter, r *http.Request) {
	stat := a.Store.Pool.Stat()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.Header().Set("Cache-Control", "no-store")
	collection.WriteMetrics(w)
	fmt.Fprintf(w, "mnemo_db_pool_acquired_connections %d\nmnemo_db_pool_max_connections %d\nmnemo_db_pool_acquire_wait_seconds_total %g\nmnemo_db_pool_empty_acquires_total %d\nmnemo_resource_query_duration_seconds_sum %g\nmnemo_resource_query_duration_seconds_count %d\n", stat.AcquiredConns(), stat.MaxConns(), stat.AcquireDuration().Seconds(), stat.EmptyAcquireCount(), float64(resourceDuration.Load())/1e9, resourceRequests.Load())
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	rows, err := a.Store.Pool.Query(ctx, `SELECT s.kind,s.stale OR s.last_success_at IS NULL OR s.last_success_at<now()-interval '60 seconds' FROM sync_states s JOIN cluster_connections c ON c.id=s.connection_id AND c.generation=s.generation`)
	if err != nil {
		fmt.Fprintln(w, "mnemo_database_available 0")
		return
	}
	defer rows.Close()
	fmt.Fprintln(w, "mnemo_database_available 1")
	for rows.Next() {
		var kind string
		var stale bool
		if rows.Scan(&kind, &stale) != nil {
			return
		}
		value := 0
		if stale {
			value = 1
		}
		fmt.Fprintf(w, "mnemo_projection_stale{kind=%q} %d\n", kind, value)
	}
}
func (a *API) syncHealth(w http.ResponseWriter, r *http.Request) {
	rows, err := a.Store.Pool.Query(r.Context(), `SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',s.kind,'initialized',s.initialized,'stale',s.stale OR s.last_success_at IS NULL OR s.last_success_at<now()-interval '60 seconds','lastSuccessAt',s.last_success_at,'error',s.error) ORDER BY s.kind),'[]'::jsonb) FROM sync_states s JOIN cluster_connections c ON c.id=s.connection_id AND c.generation=s.generation WHERE (c.metadata->>'configured')::boolean`)
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	defer rows.Close()
	if rows.Next() {
		var states json.RawMessage
		if rows.Scan(&states) == nil {
			write(w, 200, map[string]any{"kinds": states})
			return
		}
	}
	write(w, 503, nil)
}
