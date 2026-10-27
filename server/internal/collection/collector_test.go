package collection

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic/fake"
	ktesting "k8s.io/client-go/testing"
	"mnemo/server/internal/connection"
	"mnemo/server/internal/testdb"
)

func node(uid, name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{"apiVersion": "v1", "kind": "Node", "metadata": map[string]any{"uid": uid, "name": name, "resourceVersion": "1"}}}
}
func TestReconcileLifecycleAndFailureSafety(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	vault, _ := connection.NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	store := &connection.Store{Pool: pool, Vault: vault}
	generation, err := store.Replace(ctx, connection.Metadata{Configured: true, Status: "connected", Source: "kubeconfig"}, []byte("test"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	kind := Kinds[0]
	client := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{kind.GVR: "NodeList"}, node("old-uid", "same-name"))
	if err = reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal(err)
	}
	if err = reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal(err)
	}
	count := func(query string) int {
		var n int
		if e := pool.QueryRow(ctx, query).Scan(&n); e != nil {
			t.Fatal(e)
		}
		return n
	}
	if count("SELECT count(*) FROM resources") != 1 || count("SELECT count(*) FROM resource_changes") != 1 {
		t.Fatal("non-idempotent reconciliation")
	}
	client.PrependReactor("list", "nodes", func(ktesting.Action) (bool, runtime.Object, error) { return true, nil, errors.New("permission denied") })
	if err = reconcile(ctx, pool, client, kind, generation); err == nil {
		t.Fatal("permission loss not detected")
	}
	if count("SELECT count(*) FROM resources WHERE deleted_at IS NULL") != 1 {
		t.Fatal("permission error removed resources")
	}
	client.ReactionChain = client.ReactionChain[1:]
	if err = client.Resource(kind.GVR).Delete(ctx, "same-name", metav1.DeleteOptions{}); err != nil {
		t.Fatal(err)
	}
	replacement := node("new-uid", "same-name")
	replacement.SetUID(types.UID("new-uid"))
	if _, err = client.Resource(kind.GVR).Create(ctx, replacement, metav1.CreateOptions{}); err != nil {
		t.Fatal(err)
	}
	if err = reconcile(ctx, pool, client, kind, generation); err != nil {
		t.Fatal(err)
	}
	if count("SELECT count(*) FROM resources") != 2 || count("SELECT count(*) FROM resources WHERE deleted_at IS NULL") != 1 {
		t.Fatal("name reuse conflated UIDs")
	}
	if _, err = store.Replace(ctx, connection.Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, "admin"); err != nil {
		t.Fatal(err)
	}
	if err = reconcile(ctx, pool, client, kind, generation); !errors.Is(err, errGeneration) {
		t.Fatal("old generation accepted", err)
	}
}
func TestNormalizeDropsSensitivePayloads(t *testing.T) {
	obj := node("a", "safe")
	obj.SetKind("Secret")
	obj.Object["data"] = map[string]any{"token": "secret"}
	obj.SetAnnotations(map[string]string{"kubectl.kubernetes.io/last-applied-configuration": "secret"})
	encoded, err := json.Marshal(Normalize(obj))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "secret") {
		t.Fatal("sensitive payload projected")
	}
}
