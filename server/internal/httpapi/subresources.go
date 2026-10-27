package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"mnemo/server/internal/collection"
)

type relatedProjection struct {
	Kind, Name, Namespace, UID string
	Data                       map[string]any
}

func (a *API) collectionReady(ctx context.Context, generation int64, kind string) int {
	var initialized bool
	var problem *string
	err := a.Store.Pool.QueryRow(ctx, "SELECT initialized,error FROM sync_states WHERE connection_id=1 AND generation=$1 AND kind=$2", generation, kind).Scan(&initialized, &problem)
	if problem != nil && *problem == "forbidden" {
		return 403
	}
	if problem != nil && *problem == "missing-crd" {
		return 404
	}
	if err != nil || !initialized || problem != nil {
		return 503
	}
	return 200
}
func (a *API) subresource(w http.ResponseWriter, r *http.Request, kind collection.Kind, namespace, name, sub string, generation int64, data json.RawMessage) {
	var obj struct {
		Metadata struct {
			UID string `json:"uid"`
		} `json:"metadata"`
		Spec map[string]any `json:"spec"`
	}
	if json.Unmarshal(data, &obj) != nil {
		write(w, 503, nil)
		return
	}
	if sub == "events" {
		if status := a.collectionReady(r.Context(), generation, "Event"); status != 200 {
			write(w, status, map[string]string{"message": "Event collection unavailable."})
			return
		}
		rows, err := a.Store.Pool.Query(r.Context(), `SELECT data->'spec' FROM resources WHERE connection_id=1 AND generation=$1 AND kind='Event' AND deleted_at IS NULL AND data->'spec'->>'involvedUID'=$2 AND EXISTS(SELECT 1 FROM cluster_connections WHERE id=1 AND generation=$1 AND (metadata->>'configured')::boolean) ORDER BY data->'spec'->>'time' DESC,uid LIMIT 500`, generation, obj.Metadata.UID)
		if err != nil {
			write(w, 503, nil)
			return
		}
		defer rows.Close()
		events := []json.RawMessage{}
		for rows.Next() {
			var event json.RawMessage
			if rows.Scan(&event) != nil {
				write(w, 503, nil)
				return
			}
			events = append(events, event)
		}
		if rows.Err() != nil {
			write(w, 503, nil)
			return
		}
		write(w, 200, events)
		return
	}
	if kind.Name == "Service" && sub == "endpoints" {
		if status := a.collectionReady(r.Context(), generation, "EndpointSlice"); status != 200 {
			write(w, status, nil)
			return
		}
		rows, err := a.Store.Pool.Query(r.Context(), `SELECT data->'spec'->'sockets' FROM resources WHERE connection_id=1 AND generation=$1 AND kind='EndpointSlice' AND namespace=$2 AND deleted_at IS NULL AND data->'metadata'->'labels'->>'kubernetes.io/service-name'=$3 AND EXISTS(SELECT 1 FROM cluster_connections WHERE id=1 AND generation=$1 AND (metadata->>'configured')::boolean) ORDER BY name,uid`, generation, namespace, name)
		if err != nil {
			write(w, 503, nil)
			return
		}
		defer rows.Close()
		sockets := []string{}
		for rows.Next() {
			var encoded []byte
			if rows.Scan(&encoded) != nil {
				write(w, 503, nil)
				return
			}
			var values []string
			if json.Unmarshal(encoded, &values) != nil {
				write(w, 503, nil)
				return
			}
			sockets = append(sockets, values...)
		}
		if rows.Err() != nil {
			write(w, 503, nil)
			return
		}
		write(w, 200, sockets)
		return
	}
	if kind.Name == "Policy" && sub == "matches" {
		a.policyMatches(w, r, generation, namespace, name)
		return
	}
	requiredKind := ""
	switch sub {
	case "pods", "mounted-by", "affected-pods":
		requiredKind = "Pod"
	case "runs":
		requiredKind = "Job"
	case "bound-claim":
		requiredKind = "PersistentVolumeClaim"
	case "role-rules":
		requiredKind = "Role"
	case "bound-roles":
		requiredKind = "RoleBinding"
	case "related-services":
		requiredKind = "Service"
	}
	if sub == "related" && (kind.Name == "Deployment" || kind.Name == "DaemonSet" || kind.Name == "StatefulSet") {
		requiredKind = "Pod"
	}
	if requiredKind != "" {
		if status := a.collectionReady(r.Context(), generation, requiredKind); status != 200 {
			write(w, status, map[string]string{"message": "Related resource collection unavailable."})
			return
		}
	}
	// Detailed ownership panels must use ownerReferences, not selector matches.
	owned := (sub == "pods" || sub == "runs" || (sub == "related" && (kind.Name == "Deployment" || kind.Name == "DaemonSet" || kind.Name == "StatefulSet")))
	related, err := a.related(r.Context(), generation, obj.Metadata.UID, owned)
	if err != nil {
		write(w, 503, nil)
		return
	}
	names := func(target string) []string {
		values := []string{}
		for _, item := range related {
			if item.Kind == target {
				values = append(values, item.Name)
			}
		}
		return values
	}
	switch sub {
	case "pods", "mounted-by", "affected-pods":
		write(w, 200, names("Pod"))
	case "runs":
		runs := []any{}
		for _, item := range related {
			if item.Kind == "Job" {
				meta, _ := item.Data["metadata"].(map[string]any)
				runs = append(runs, map[string]any{"name": item.Name, "time": meta["createdAt"]})
			}
		}
		write(w, 200, runs)
	case "bound-claim":
		for _, item := range related {
			if item.Kind == "PersistentVolumeClaim" {
				write(w, 200, item.Namespace+"/"+item.Name)
				return
			}
		}
		write(w, 200, nil)
	case "related-services":
		write(w, 200, names("Service"))
	case "role-rules":
		for _, item := range related {
			if item.Kind == "Role" {
				spec, _ := item.Data["spec"].(map[string]any)
				write(w, 200, spec["rules"])
				return
			}
		}
		write(w, 200, []any{})
	case "bound-roles":
		roles := []string{}
		for _, item := range related {
			if item.Kind == "RoleBinding" {
				spec, _ := item.Data["spec"].(map[string]any)
				if role, ok := spec["roleRef"].(string); ok {
					roles = append(roles, role)
				}
			}
		}
		write(w, 200, roles)
	case "related":
		if kind.Name == "Deployment" || kind.Name == "DaemonSet" || kind.Name == "StatefulSet" {
			write(w, 200, map[string]any{"pods": names("Pod")})
			return
		}
		if kind.Name == "Role" {
			write(w, 200, names("RoleBinding"))
			return
		}
		refs := []any{}
		for _, item := range related {
			ref := map[string]string{"kind": collection.UIKind(item.Kind), "name": item.Name}
			if item.Namespace != "" {
				ref["namespace"] = item.Namespace
			}
			refs = append(refs, ref)
		}
		write(w, 200, refs)
	default:
		write(w, 404, nil)
	}
}
func (a *API) related(ctx context.Context, generation int64, uid string, owned bool) ([]relatedProjection, error) {
	rows, err := a.Store.Pool.Query(ctx, `WITH RECURSIVE reachable(id,depth) AS (
 SELECT id,0 FROM resources WHERE connection_id=1 AND generation=$1 AND uid=$2 AND deleted_at IS NULL
 UNION
 SELECT rel.source_id,reachable.depth+1 FROM reachable JOIN resource_relations rel ON rel.target_id=reachable.id WHERE $3 AND rel.relation_type='owned-by' AND rel.valid_to IS NULL AND reachable.depth<8
 ), related_ids AS (
 SELECT id FROM reachable WHERE depth>0 AND $3
 UNION SELECT CASE WHEN rel.source_id=r.id THEN rel.target_id ELSE rel.source_id END FROM resources r JOIN resource_relations rel ON rel.source_id=r.id OR rel.target_id=r.id WHERE NOT $3 AND r.connection_id=1 AND r.generation=$1 AND r.uid=$2 AND rel.valid_to IS NULL
 ) SELECT r.kind,r.namespace,r.name,r.uid,r.data FROM related_ids i JOIN resources r ON r.id=i.id JOIN sync_states s ON s.connection_id=r.connection_id AND s.generation=r.generation AND s.kind=r.kind
 WHERE r.connection_id=1 AND r.generation=$1 AND r.deleted_at IS NULL AND s.initialized AND s.error IS NULL AND EXISTS(SELECT 1 FROM cluster_connections WHERE id=1 AND generation=$1 AND (metadata->>'configured')::boolean) ORDER BY r.kind,r.namespace,r.name,r.uid LIMIT 1000`, generation, uid, owned)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []relatedProjection{}
	for rows.Next() {
		var item relatedProjection
		var encoded []byte
		if err = rows.Scan(&item.Kind, &item.Namespace, &item.Name, &item.UID, &encoded); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(encoded, &item.Data); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}
func (a *API) policyMatches(w http.ResponseWriter, r *http.Request, generation int64, namespace, name string) {
	if status := a.collectionReady(r.Context(), generation, "PolicyReport"); status != 200 {
		write(w, status, nil)
		return
	}
	rows, err := a.Store.Pool.Query(r.Context(), `SELECT result FROM resources r CROSS JOIN LATERAL jsonb_array_elements(r.data->'spec'->'results') result WHERE r.connection_id=1 AND r.generation=$1 AND r.kind='PolicyReport' AND r.deleted_at IS NULL AND result->>'policy'=$2 AND r.namespace=$3 AND EXISTS(SELECT 1 FROM cluster_connections WHERE id=1 AND generation=$1 AND (metadata->>'configured')::boolean) ORDER BY r.namespace,r.name,r.uid LIMIT 500`, generation, name, namespace)
	if err != nil {
		write(w, 503, nil)
		return
	}
	defer rows.Close()
	matches := []any{}
	for rows.Next() {
		var result map[string]any
		var encoded []byte
		if rows.Scan(&encoded) != nil || json.Unmarshal(encoded, &result) != nil {
			write(w, 503, nil)
			return
		}
		matches = append(matches, map[string]any{"resource": result["resource"], "result": result["result"]})
	}
	if rows.Err() != nil {
		write(w, 503, nil)
		return
	}
	write(w, 200, matches)
}
