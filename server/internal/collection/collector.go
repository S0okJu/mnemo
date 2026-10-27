package collection

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

// Run uses informer events as coalesced invalidations. A one-slot queue bounds
// memory; every processing pass reconciles a complete paginated API snapshot.
// Intermediate updates are intentionally not an audit log.
func Run(ctx context.Context, pool *pgxpool.Pool, config *rest.Config, generation int64, notify func()) error {
	return RunWithOptions(ctx, pool, config, generation, notify, Options{})
}
func RunWithOptions(ctx context.Context, pool *pgxpool.Pool, config *rest.Config, generation int64, notify func(), options Options) error {
	options = options.defaults()
	rawClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return err
	}
	client, err := metadataSafeClient(config, rawClient)
	if err != nil {
		return err
	}
	factory := dynamicinformer.NewDynamicSharedInformerFactory(rawClient, options.ReconcileInterval)
	queue := make(chan struct{}, 1)
	defer queueDepth.Store(0)
	signal := func() {
		select {
		case queue <- struct{}{}:
			queueDepth.Store(int64(len(queue)))
		default:
			coalesced.Add(1)
		}
	}
	for _, kind := range Kinds {
		if kind.Name == "Secret" {
			continue
		}
		informer := factory.ForResource(kind.GVR).Informer()
		// Transport errors may contain response bodies. Synchronization failures
		// are classified in sync_states instead of logging upstream payloads.
		if err = informer.SetWatchErrorHandlerWithContext(func(context.Context, *cache.Reflector, error) {}); err != nil {
			return err
		}
		_, err = informer.AddEventHandler(cache.ResourceEventHandlerFuncs{AddFunc: func(any) { signal() }, UpdateFunc: func(any, any) { signal() }, DeleteFunc: func(any) { signal() }})
		if err != nil {
			return err
		}
	}
	factory.Start(ctx.Done())
	defer factory.Shutdown()
	signal()
	timer := time.NewTicker(options.ReconcileInterval)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-queue:
		case <-timer.C:
		}
		queueDepth.Store(int64(len(queue)))
		// Debounce watch bursts while retaining only one pending invalidation.
		wait := time.NewTimer(300 * time.Millisecond)
		select {
		case <-ctx.Done():
			wait.Stop()
			return nil
		case <-wait.C:
		}
		for _, kind := range Kinds {
			if ctx.Err() != nil {
				return nil
			}
			started := time.Now()
			err = reconcileWithOptions(ctx, pool, client, kind, generation, options)
			observe(kind.Name, started, err)
			if err != nil {
				if errors.Is(err, errGeneration) {
					return nil
				}
				// Transport and Kubernetes errors may include sensitive payloads. Persist
				// only a bounded public classification, never the original error string.
				problem := "unavailable"
				if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) {
					problem = "forbidden"
				}
				if apierrors.IsNotFound(err) {
					problem = "missing-crd"
				}
				_, _ = pool.Exec(ctx, `INSERT INTO sync_states(connection_id,generation,kind,stale,error) VALUES(1,$1,$2,true,$3) ON CONFLICT(connection_id,generation,kind) DO UPDATE SET stale=true,error=EXCLUDED.error`, generation, kind.Name, problem)
			} else if notify != nil {
				notify()
			}
		}
	}
}

var errGeneration = errors.New("connection generation changed")

func reconcile(ctx context.Context, pool *pgxpool.Pool, client dynamic.Interface, kind Kind, generation int64) error {
	return reconcileWithOptions(ctx, pool, client, kind, generation, Options{})
}
func reconcileWithOptions(ctx context.Context, pool *pgxpool.Pool, client dynamic.Interface, kind Kind, generation int64, options Options) error {
	options = options.defaults()
	snapshotCtx, snapshotCancel := context.WithTimeout(ctx, options.SnapshotTimeout)
	defer snapshotCancel()
	// Stage a complete snapshot before opening the database transaction. A failed
	// page can never mark previously persisted resources deleted.
	snapshot := []unstructured.Unstructured{}
	continuation := ""
	for {
		pageCtx, cancel := context.WithTimeout(snapshotCtx, 10*time.Second)
		page, err := client.Resource(kind.GVR).List(pageCtx, metav1.ListOptions{Limit: 500, Continue: continuation})
		cancel()
		if err != nil {
			return err
		}
		if len(snapshot)+len(page.Items) > options.MaxSnapshotResources {
			return errors.New("snapshot resource limit exceeded")
		}
		snapshot = append(snapshot, page.Items...)
		continuation = page.GetContinue()
		if continuation == "" {
			break
		}
	}
	identities := make(map[string]bool, len(snapshot))
	for _, obj := range snapshot {
		uid := string(obj.GetUID())
		if uid == "" || identities[uid] {
			return errors.New("invalid snapshot identity")
		}
		identities[uid] = true
	}
	var cancel context.CancelFunc
	ctx, cancel = context.WithTimeout(ctx, options.TransactionTimeout)
	defer cancel()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var active int64
	var configured bool
	// The shared lock fences all projection writes against Replace's row lock.
	err = tx.QueryRow(ctx, "SELECT generation,(metadata->>'configured')::boolean FROM cluster_connections WHERE id=1 FOR SHARE").Scan(&active, &configured)
	if err != nil {
		return err
	}
	if active != generation || !configured {
		return errGeneration
	}
	seen := make([]string, 0, len(snapshot))
	for _, obj := range snapshot {
		uid := string(obj.GetUID())
		if uid == "" {
			continue
		}
		seen = append(seen, uid)
		data, err := json.Marshal(Normalize(&obj))
		if err != nil {
			return err
		}
		var id int64
		var previous []byte
		err = tx.QueryRow(ctx, "SELECT id,data FROM resources WHERE connection_id=1 AND generation=$1 AND uid=$2", generation, uid).Scan(&id, &previous)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		err = tx.QueryRow(ctx, `INSERT INTO resources(connection_id,generation,uid,api_group,kind,namespace,name,data,resource_version) VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(connection_id,generation,uid) DO UPDATE SET data=EXCLUDED.data,resource_version=EXCLUDED.resource_version,observed_at=now(),deleted_at=NULL RETURNING id`, generation, uid, kind.GVR.Group, kind.Name, obj.GetNamespace(), obj.GetName(), data, obj.GetResourceVersion()).Scan(&id)
		if err != nil {
			return err
		}
		// History initially records lifecycle only. Current-state changes coalesce.
		if previous == nil {
			if _, err = tx.Exec(ctx, "INSERT INTO resource_changes(resource_id,change_type,summary) VALUES($1,'created',$2)", id, []byte(`{"evidence":"initial observation"}`)); err != nil {
				return err
			}
		}
	}
	_, err = tx.Exec(ctx, `WITH removed AS (UPDATE resources SET deleted_at=now() WHERE connection_id=1 AND generation=$1 AND kind=$2 AND deleted_at IS NULL AND NOT(uid=ANY($3::text[])) RETURNING id) INSERT INTO resource_changes(resource_id,change_type,summary) SELECT id,'deleted','{"evidence":"absent from complete snapshot"}'::jsonb FROM removed`, generation, kind.Name, seen)
	if err != nil {
		return err
	}
	// Owner and binding relationships are rebuilt transactionally after the
	// resource upserts. References with unavailable targets remain unresolved.
	if err = relations(ctx, tx, generation, snapshot); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO sync_states(connection_id,generation,kind,initialized,stale,last_success_at) VALUES(1,$1,$2,true,false,now()) ON CONFLICT(connection_id,generation,kind) DO UPDATE SET initialized=true,stale=false,last_success_at=now(),error=NULL`, generation, kind.Name)
	if err != nil {
		return err
	}
	if kind.Name == "Service" || kind.Name == "EndpointSlice" {
		if err = enrichServiceHealth(ctx, tx, generation); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func relations(ctx context.Context, tx pgx.Tx, generation int64, objects []unstructured.Unstructured) error {
	for _, obj := range objects {
		var source int64
		if err := tx.QueryRow(ctx, "SELECT id FROM resources WHERE connection_id=1 AND generation=$1 AND uid=$2", generation, string(obj.GetUID())).Scan(&source); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, "UPDATE resource_relations SET valid_to=now() WHERE source_id=$1 AND valid_to IS NULL", source); err != nil {
			return err
		}

		for _, ref := range References(&obj) {
			evidence, _ := json.Marshal(ref)
			_, err := tx.Exec(ctx, `INSERT INTO resource_relations(source_id,target_id,relation_type,evidence)
    SELECT $1,id,$2,$3 FROM resources WHERE connection_id=1 AND generation=$4 AND deleted_at IS NULL
    AND (($5<>'' AND uid=$5) OR ($5='' AND kind=$6 AND namespace=$7 AND name=$8))
    ON CONFLICT(source_id,target_id,relation_type) DO UPDATE SET evidence=EXCLUDED.evidence,observed_at=now(),valid_to=NULL`, source, ref.Relation, evidence, generation, ref.UID, ref.Kind, ref.Namespace, ref.Name)
			if err != nil {
				return err
			}
		}
		if selector, raw, ok := PodSelector(&obj); ok {
			rows, err := tx.Query(ctx, "SELECT id,data->'metadata'->'labels' FROM resources WHERE connection_id=1 AND generation=$1 AND kind='Pod' AND namespace=$2 AND deleted_at IS NULL", generation, obj.GetNamespace())
			if err != nil {
				return err
			}
			selected := []int64{}
			for rows.Next() {
				var id int64
				var encoded []byte
				if err = rows.Scan(&id, &encoded); err != nil {
					rows.Close()
					return err
				}
				values := map[string]string{}
				if len(encoded) > 0 && string(encoded) != "null" {
					if err = json.Unmarshal(encoded, &values); err != nil {
						rows.Close()
						return err
					}
				}
				if selector.Matches(labels.Set(values)) {
					selected = append(selected, id)
				}
			}
			err = rows.Err()
			rows.Close()
			if err != nil {
				return err
			}
			evidence, _ := json.Marshal(map[string]any{"method": "selector", "selector": raw})
			for _, id := range selected {
				if _, err = tx.Exec(ctx, `INSERT INTO resource_relations(source_id,target_id,relation_type,evidence) VALUES($1,$2,'selects',$3) ON CONFLICT(source_id,target_id,relation_type) DO UPDATE SET evidence=EXCLUDED.evidence,observed_at=now(),valid_to=NULL`, source, id, evidence); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
