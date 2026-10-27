package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// Relation queries are fenced by the active generation and each endpoint's
// current collection permissions, just like resource projections. Evidence
// describes configuration references, never observed traffic or causation.
func (a *API) relations(w http.ResponseWriter, r *http.Request) {
	m, _, generation, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	if !m.Configured {
		write(w, 409, map[string]string{"reason": "not-configured"})
		return
	}
	query := r.URL.Query()
	uid := query.Get("uid")
	direction := query.Get("direction")
	if direction == "" {
		direction = "both"
	}
	if (direction != "both" && direction != "incoming" && direction != "outgoing") || (direction != "both" && uid == "") {
		write(w, 400, map[string]string{"message": "Use both, incoming or outgoing; directional queries require uid."})
		return
	}
	limit, offset := 100, 0
	for key, target := range map[string]*int{"limit": &limit, "offset": &offset} {
		if raw := query.Get(key); raw != "" {
			n, e := strconv.Atoi(raw)
			if e != nil || n < 0 {
				write(w, 400, nil)
				return
			}
			*target = n
		}
	}
	if limit < 1 || limit > 500 {
		write(w, 400, nil)
		return
	}
	rows, err := a.Store.Pool.Query(r.Context(), `WITH filtered AS (
 SELECT rel.id,s.uid AS source_uid,t.uid AS target_uid,rel.relation_type,
 jsonb_build_object('source',jsonb_build_object('uid',s.uid,'kind',s.kind,'namespace',s.namespace,'name',s.name),
 'target',jsonb_build_object('uid',t.uid,'kind',t.kind,'namespace',t.namespace,'name',t.name),
 'type',rel.relation_type,'evidence',rel.evidence,'observedAt',rel.observed_at) AS data
 FROM resource_relations rel JOIN resources s ON s.id=rel.source_id JOIN resources t ON t.id=rel.target_id
 JOIN cluster_connections c ON c.id=s.connection_id AND c.id=t.connection_id AND c.generation=s.generation AND c.generation=t.generation
 JOIN sync_states ss ON ss.connection_id=c.id AND ss.generation=c.generation AND ss.kind=s.kind
 JOIN sync_states ts ON ts.connection_id=c.id AND ts.generation=c.generation AND ts.kind=t.kind
 WHERE c.id=1 AND c.generation=$1 AND (c.metadata->>'configured')::boolean
 AND rel.valid_to IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL
 AND ss.initialized AND ts.initialized AND ss.error IS NULL AND ts.error IS NULL
 AND ($2='' OR (($3='both' OR $3='outgoing') AND s.uid=$2) OR (($3='both' OR $3='incoming') AND t.uid=$2))
 AND ($4='' OR s.kind=$4 OR t.kind=$4) AND ($5='' OR s.namespace=$5 OR t.namespace=$5)
 AND ($6='' OR rel.relation_type=$6)
 ) SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(page.data ORDER BY page.source_uid,page.target_uid,page.relation_type,page.id) FROM (SELECT * FROM filtered ORDER BY source_uid,target_uid,relation_type,id LIMIT $7 OFFSET $8) page),'[]'::jsonb)`, generation, uid, direction, query.Get("kind"), query.Get("namespace"), query.Get("type"), limit, offset)
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	defer rows.Close()
	if rows.Next() {
		var count int
		var items json.RawMessage
		if rows.Scan(&count, &items) == nil {
			write(w, 200, map[string]any{"items": items, "total": count, "semantics": "configuration"})
			return
		}
	}
	write(w, 503, nil)
}
