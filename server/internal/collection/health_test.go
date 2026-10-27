package collection

import (
	"context"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
)

func TestHealthReflectsControllerReadinessAndFailurePrecedence(t *testing.T) {
	for _, tt := range []struct {
		name, kind   string
		spec, status map[string]any
		want         string
	}{
		{"deployment ready", "Deployment", map[string]any{"replicas": int64(2)}, map[string]any{"readyReplicas": int64(2), "availableReplicas": int64(2), "updatedReplicas": int64(2)}, "Healthy"},
		{"deployment rollout", "Deployment", map[string]any{"replicas": int64(2)}, map[string]any{"readyReplicas": int64(1)}, "Progressing"},
		{"deployment deadline", "Deployment", map[string]any{"replicas": int64(1)}, map[string]any{"conditions": []any{map[string]any{"type": "Progressing", "status": "False"}}}, "Error"},
		{"scaled down", "ReplicaSet", map[string]any{"replicas": int64(0)}, map[string]any{}, "Healthy"},
		{"daemon ready", "DaemonSet", nil, map[string]any{"desiredNumberScheduled": int64(1), "numberReady": int64(1)}, "Healthy"},
		{"stateful ready", "StatefulSet", map[string]any{"replicas": int64(1)}, map[string]any{"readyReplicas": int64(1), "updatedReplicas": int64(1)}, "Healthy"},
		{"pod not ready", "Pod", nil, map[string]any{"phase": "Running", "conditions": []any{map[string]any{"type": "Ready", "status": "False"}}}, "Progressing"},
		{"pod crash overrides ready", "Pod", nil, map[string]any{"phase": "Running", "conditions": []any{map[string]any{"type": "Ready", "status": "True"}}, "containerStatuses": []any{map[string]any{"state": map[string]any{"waiting": map[string]any{"reason": "CrashLoopBackOff"}}}}}, "Error"},
		{"job complete", "Job", nil, map[string]any{"conditions": []any{map[string]any{"type": "Complete", "status": "True"}}}, "Healthy"},
		{"job failed", "Job", nil, map[string]any{"conditions": []any{map[string]any{"type": "Failed", "status": "True"}}}, "Error"},
		{"claim bound", "PersistentVolumeClaim", nil, map[string]any{"phase": "Bound"}, "Healthy"},
		{"claim lost", "PersistentVolumeClaim", nil, map[string]any{"phase": "Lost"}, "Error"},
		{"config has no readiness", "ConfigMap", nil, nil, "Unknown"},
		{"provider ready bool", "ProviderNetwork", nil, map[string]any{"ready": true}, "Healthy"},
		{"condition error overrides ready", "Subnet", nil, map[string]any{"conditions": []any{map[string]any{"type": "Ready", "status": "True"}, map[string]any{"type": "Error", "status": "True"}}}, "Error"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			obj := node("id", "test")
			obj.SetKind(tt.kind)
			if tt.spec != nil {
				obj.Object["spec"] = tt.spec
			}
			if tt.status != nil {
				obj.Object["status"] = tt.status
			}
			got := Normalize(obj)["status"].(map[string]any)
			if got["level"] != tt.want {
				t.Fatalf("got %v want %s (%v)", got["level"], tt.want, got["message"])
			}
		})
	}
}
func TestServiceReadinessUsesCommittedAuthorizedEndpointSlices(t *testing.T) {
	pool, generation := prepare(t)
	ctx := context.Background()
	var serviceKind, sliceKind Kind
	for _, kind := range Kinds {
		if kind.Name == "Service" {
			serviceKind = kind
		}
		if kind.Name == "EndpointSlice" {
			sliceKind = kind
		}
	}
	service := &unstructured.Unstructured{Object: map[string]any{"apiVersion": "v1", "kind": "Service", "metadata": map[string]any{"uid": "service", "name": "web", "namespace": "work"}, "spec": map[string]any{"type": "ClusterIP"}}}
	slice := &unstructured.Unstructured{Object: map[string]any{"apiVersion": "discovery.k8s.io/v1", "kind": "EndpointSlice", "metadata": map[string]any{"uid": "slice", "name": "web-slice", "namespace": "work", "labels": map[string]any{"kubernetes.io/service-name": "web"}}, "ports": []any{map[string]any{"port": int64(80)}}, "endpoints": []any{map[string]any{"addresses": []any{"10.0.0.2"}, "conditions": map[string]any{"ready": true}}}}}
	client := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{serviceKind.GVR: "ServiceList", sliceKind.GVR: "EndpointSliceList"}, service, slice)
	level := func() string {
		t.Helper()
		var v string
		if err := pool.QueryRow(ctx, "SELECT data->'status'->>'level' FROM resources WHERE uid='service'").Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	if err := reconcile(ctx, pool, client, serviceKind, generation); err != nil {
		t.Fatal(err)
	}
	if level() != "Unknown" {
		t.Fatal("health inferred before endpoint snapshot")
	}
	if err := reconcile(ctx, pool, client, sliceKind, generation); err != nil {
		t.Fatal(err)
	}
	if level() != "Healthy" {
		t.Fatal("ready endpoints not reflected")
	}
	if err := client.Resource(sliceKind.GVR).Namespace("work").Delete(ctx, "web-slice", metav1.DeleteOptions{}); err != nil {
		t.Fatal(err)
	}
	if err := reconcile(ctx, pool, client, sliceKind, generation); err != nil {
		t.Fatal(err)
	}
	if level() != "Warning" {
		t.Fatal("lost endpoints still reported healthy")
	}
}
