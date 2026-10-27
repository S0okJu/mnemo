package collection

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
)

func TestSecretListNegotiatesMetadataAndDropsSensitiveFields(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/namespaces/work/secrets" || !strings.Contains(r.Header.Get("Accept"), "PartialObjectMetadataList") {
			t.Error("full Secret request", r.URL.Path, r.Header.Get("Accept"))
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"apiVersion":"meta.k8s.io/v1","kind":"PartialObjectMetadataList","metadata":{"resourceVersion":"123"},"items":[{"metadata":{"name":"private","namespace":"work","uid":"secret-uid","annotations":{"sensitive":"do-not-project"}},"data":{"token":"do-not-project"}}]}`)
	}))
	defer server.Close()
	config := &rest.Config{Host: server.URL}
	raw, err := dynamic.NewForConfig(config)
	if err != nil {
		t.Fatal(err)
	}
	client, err := metadataSafeClient(config, raw)
	if err != nil {
		t.Fatal(err)
	}
	page, err := client.Resource(schema.GroupVersionResource{Version: "v1", Resource: "secrets"}).Namespace("work").List(context.Background(), metav1.ListOptions{})
	if err != nil || len(page.Items) != 1 {
		t.Fatal("metadata list failed", err)
	}
	encoded, _ := json.Marshal(page.Items[0].Object)
	if strings.Contains(string(encoded), "do-not-project") || strings.Contains(string(encoded), `"data"`) {
		t.Fatal("Secret payload or annotations entered collector")
	}
	normalized, _ := json.Marshal(Normalize(&page.Items[0]))
	if strings.Contains(string(normalized), "do-not-project") {
		t.Fatal("Secret payload projected")
	}
}
func TestExpandedNormalizationDoesNotPersistPayloads(t *testing.T) {
	for _, kind := range []string{"Pod", "Deployment", "ConfigMap", "Secret", "Event", "PolicyReport", "ServiceAccount"} {
		t.Run(kind, func(t *testing.T) {
			obj := node("uid", "example")
			obj.SetKind(kind)
			obj.SetNamespace("work")
			obj.SetAnnotations(map[string]string{"last-applied": "private-payload"})
			obj.Object["data"] = map[string]any{"config": "private-payload"}
			obj.Object["stringData"] = map[string]any{"password": "private-payload"}
			obj.Object["message"] = "private-payload"
			obj.Object["spec"] = map[string]any{"containers": []any{map[string]any{"name": "app", "image": "safe:v1", "env": []any{map[string]any{"name": "PASSWORD", "value": "private-payload"}}}}, "template": map[string]any{"spec": map[string]any{"containers": []any{map[string]any{"env": []any{map[string]any{"value": "private-payload"}}}}}}}
			obj.Object["results"] = []any{map[string]any{"message": "private-payload", "rule": "safe-rule", "result": "fail"}}
			encoded, err := json.Marshal(Normalize(obj))
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(string(encoded), "private-payload") {
				t.Fatalf("%s persisted sensitive payload", kind)
			}
		})
	}
}
func TestSelectorsAndOwnerEvidenceAreDistinct(t *testing.T) {
	pool, generation := prepare(t)
	ctx := context.Background()
	objects := []runtime.Object{}
	listKinds := map[schema.GroupVersionResource]string{}
	makeObject := func(kind, name, uid string) *unstructured.Unstructured {
		obj := node(uid, name)
		obj.SetKind(kind)
		obj.SetNamespace("work")
		obj.SetLabels(map[string]string{"app": "demo"})
		if kind == "Deployment" || kind == "ReplicaSet" {
			obj.SetAPIVersion("apps/v1")
		}
		return obj
	}
	deployment := makeObject("Deployment", "demo", "deployment")
	deployment.Object["spec"] = map[string]any{"selector": map[string]any{"matchLabels": map[string]any{"app": "demo"}}}
	rs := makeObject("ReplicaSet", "demo-rs", "replicaset")
	rs.SetOwnerReferences([]metav1.OwnerReference{{APIVersion: "apps/v1", Kind: "Deployment", Name: "demo", UID: types.UID("deployment")}})
	owned := makeObject("Pod", "owned", "owned")
	owned.SetOwnerReferences([]metav1.OwnerReference{{APIVersion: "apps/v1", Kind: "ReplicaSet", Name: "demo-rs", UID: types.UID("replicaset")}})
	unowned := makeObject("Pod", "same-label-no-owner", "unowned")
	otherNS := makeObject("Pod", "other-namespace", "other")
	otherNS.SetNamespace("other")
	objects = append(objects, deployment, rs, owned, unowned, otherNS)
	for _, kind := range Kinds {
		listKinds[kind.GVR] = kind.Name + "List"
	}
	client := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), listKinds, objects...)
	for _, name := range []string{"Pod", "Deployment", "ReplicaSet", "Pod", "Deployment"} {
		for _, kind := range Kinds {
			if kind.Name == name {
				if err := reconcile(ctx, pool, client, kind, generation); err != nil {
					t.Fatal(name, err)
				}
			}
		}
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM resource_relations rel JOIN resources s ON s.id=rel.source_id JOIN resources t ON t.id=rel.target_id WHERE s.uid='deployment' AND rel.relation_type='selects' AND rel.valid_to IS NULL`).Scan(&count); err != nil || count != 2 {
		t.Fatal("selector crossed namespace or omitted matching pod", count, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM resource_relations rel JOIN resources s ON s.id=rel.source_id WHERE s.uid='unowned' AND rel.relation_type='owned-by'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("ownership inferred from label", count, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM resource_relations rel JOIN resources s ON s.id=rel.source_id JOIN resources t ON t.id=rel.target_id WHERE s.uid='owned' AND t.uid='replicaset' AND rel.evidence->>'method'='ownerReference' AND rel.valid_to IS NULL`).Scan(&count); err != nil || count != 1 {
		t.Fatal("missing actual owner evidence", count, err)
	}
}
