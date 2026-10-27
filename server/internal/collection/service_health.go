package collection

import (
	"context"
	"github.com/jackc/pgx/v5"
)

// enrichServiceHealth uses only a complete, authorized EndpointSlice projection.
// It reports endpoint readiness, not proof of observed network traffic.
func enrichServiceHealth(ctx context.Context, tx pgx.Tx, generation int64) error {
	var ready bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sync_states WHERE connection_id=1 AND generation=$1 AND kind='EndpointSlice' AND initialized AND NOT stale AND error IS NULL)`, generation).Scan(&ready); err != nil {
		return err
	}
	if !ready {
		return nil
	}
	_, err := tx.Exec(ctx, `WITH observations AS (
 SELECT s.id,
 COALESCE(s.data->'spec'->>'type','ClusterIP') AS service_type,
 CASE WHEN jsonb_typeof(s.data->'spec'->'externalAddresses')='array' THEN jsonb_array_length(s.data->'spec'->'externalAddresses') ELSE 0 END AS external_addresses,
 EXISTS(SELECT 1 FROM resources e WHERE e.connection_id=1 AND e.generation=$1 AND e.kind='EndpointSlice' AND e.namespace=s.namespace AND e.deleted_at IS NULL AND e.data->'metadata'->'labels'->>'kubernetes.io/service-name'=s.name AND COALESCE(jsonb_array_length(e.data->'spec'->'sockets'),0)>0) AS has_ready_endpoints
 FROM resources s WHERE s.connection_id=1 AND s.generation=$1 AND s.kind='Service' AND s.deleted_at IS NULL
 ) UPDATE resources r SET data=jsonb_set(r.data,'{status}',(r.data->'status')||jsonb_build_object(
 'level',CASE WHEN o.service_type='LoadBalancer' AND o.external_addresses=0 THEN 'Progressing' WHEN o.has_ready_endpoints THEN 'Healthy' ELSE 'Warning' END,
 'message',CASE WHEN o.service_type='LoadBalancer' AND o.external_addresses=0 THEN 'Waiting for a load balancer address.' WHEN o.has_ready_endpoints THEN 'Ready service endpoints are reported; traffic is not verified.' ELSE 'No ready service endpoints are reported.' END,
 'healthMethod','EndpointSlice'),false)
 FROM observations o WHERE r.id=o.id AND o.service_type<>'ExternalName'`, generation)
	return err
}
