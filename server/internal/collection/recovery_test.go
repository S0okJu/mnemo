package collection

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
	ktesting "k8s.io/client-go/testing"
	"mnemo/server/internal/connection"
	"mnemo/server/internal/testdb"
)

func prepare(t *testing.T) (*pgxpool.Pool, int64) {
	t.Helper()
	pool := testdb.Pool(t)
	vault, _ := connection.NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	generation, err := (&connection.Store{Pool: pool, Vault: vault}).Replace(context.Background(), connection.Metadata{Configured: true, Source: "kubeconfig"}, []byte("encrypted"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	return pool, generation
}
func TestFailedSnapshotsPreserveCurrentState(t *testing.T) {
	pool, generation := prepare(t)
	ctx := context.Background()
	kind := Kinds[0]
	client := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{kind.GVR: "NodeList"}, node("one", "first"), node("two", "second"))
	if err := reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal(err)
	}
	assertUnchanged := func() {
		t.Helper()
		var count int
		if err := pool.QueryRow(ctx, "SELECT count(*) FROM resources WHERE deleted_at IS NULL").Scan(&count); err != nil || count != 2 {
			t.Fatalf("failed snapshot changed current state: %d %v", count, err)
		}
	}
	for _, problem := range []error{apierrors.NewNotFound(schema.GroupResource{Group: "kubeovn.io", Resource: "vpcs"}, ""), apierrors.NewForbidden(schema.GroupResource{Resource: "nodes"}, "", errors.New("denied"))} {
		client.PrependReactor("list", "nodes", func(ktesting.Action) (bool, runtime.Object, error) { return true, nil, problem })
		if err := reconcile(ctx, pool, client, kind, generation); err == nil {
			t.Fatal("failed snapshot accepted")
		}
		assertUnchanged()
		client.ReactionChain = client.ReactionChain[1:]
	}
	calls := 0
	client.PrependReactor("list", "nodes", func(ktesting.Action) (bool, runtime.Object, error) {
		calls++
		if calls == 1 {
			page := &unstructured.UnstructuredList{Items: []unstructured.Unstructured{*node("one", "first")}}
			page.SetContinue("next")
			return true, page, nil
		}
		return true, nil, errors.New("second page failed")
	})
	if err := reconcile(ctx, pool, client, kind, generation); err == nil || calls != 2 {
		t.Fatal("partial snapshot accepted", err, calls)
	}
	assertUnchanged()
	client.ReactionChain = client.ReactionChain[1:]
	if err := reconcileWithOptions(ctx, pool, client, kind, generation, Options{MaxSnapshotResources: 1}); err == nil {
		t.Fatal("snapshot resource bound ignored")
	}
	assertUnchanged()
	// A temporarily unreachable DB fails this pass, then a fresh authorized
	// snapshot converges through the same collector without retained event growth.
	failedConfig := pool.Config().Copy()
	failedConfig.ConnConfig.Port = 1
	failedConfig.ConnConfig.ConnectTimeout = 100 * time.Millisecond
	unavailable, err := pgxpool.NewWithConfig(ctx, failedConfig)
	if err != nil {
		t.Fatal(err)
	}
	attempt, cancel := context.WithTimeout(ctx, time.Second)
	err = reconcile(attempt, unavailable, client, kind, generation)
	cancel()
	unavailable.Close()
	if err == nil {
		t.Fatal("database outage was not reported")
	}
	assertUnchanged()
	if err = client.Resource(kind.GVR).Delete(ctx, "second", metav1.DeleteOptions{}); err != nil {
		t.Fatal(err)
	}
	if err = reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal("recovery failed", err)
	}
	var count int
	if err = pool.QueryRow(ctx, "SELECT count(*) FROM resources WHERE deleted_at IS NULL").Scan(&count); err != nil || count != 1 {
		t.Fatal("recovery did not converge", count, err)
	}
}

func TestRetentionPreservesCurrentAndUnexpiredEvidence(t *testing.T) {
	pool, generation := prepare(t)
	ctx := context.Background()
	kind := Kinds[0]
	client := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{kind.GVR: "NodeList"}, node("active", "active"), node("retained", "retained"), node("expired", "expired"))
	if err := reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE resources SET deleted_at=now()-interval '31 days' WHERE uid IN ('retained','expired')"); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE resource_changes SET expires_at=now()-interval '1 day' WHERE resource_id IN (SELECT id FROM resources WHERE uid='expired')"); err != nil {
		t.Fatal(err)
	}
	if err := Prune(ctx, pool, 30*24*time.Hour, 10); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM resources WHERE uid IN ('active','retained')").Scan(&count); err != nil || count != 2 {
		t.Fatal("retained evidence deleted", count, err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM resources WHERE uid='expired'").Scan(&count); err != nil || count != 0 {
		t.Fatal("expired projection retained", count, err)
	}
}
