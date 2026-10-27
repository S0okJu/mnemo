package collection

import "testing"

func TestPolicyReportProjectsResultTargets(t *testing.T) {
	for _, tt := range []struct {
		name   string
		object map[string]any
		want   []string
	}{
		{"namespaced scope", map[string]any{
			"scope":   map[string]any{"kind": "Deployment", "namespace": "openstack", "name": "neutron-rpc-server"},
			"results": []any{map[string]any{"policy": "require-resource-requests-limits", "rule": "require-container-requests-limits", "result": "pass"}},
		}, []string{"Deployment/openstack/neutron-rpc-server"}},
		{"cluster-scoped scope", map[string]any{
			"scope":   map[string]any{"kind": "Namespace", "name": "openstack"},
			"results": []any{map[string]any{"policy": "p", "rule": "r", "result": "fail"}},
		}, []string{"Namespace/openstack"}},
		{"per-result resources", map[string]any{
			"results": []any{map[string]any{"policy": "p", "rule": "r", "result": "warn", "resources": []any{
				map[string]any{"kind": "Pod", "namespace": "work", "name": "a"},
				map[string]any{"kind": "Pod", "namespace": "work", "name": "b"},
			}}},
		}, []string{"Pod/work/a", "Pod/work/b"}},
		{"no target", map[string]any{
			"results": []any{map[string]any{"policy": "p", "rule": "r", "result": "skip"}},
		}, []string{""}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			obj := node("id", "report")
			obj.SetKind("PolicyReport")
			obj.SetNamespace("work")
			for key, value := range tt.object {
				obj.Object[key] = value
			}
			results := Normalize(obj)["spec"].(map[string]any)["results"].([]any)
			if len(results) != len(tt.want) {
				t.Fatalf("got %d results want %d", len(results), len(tt.want))
			}
			for i, want := range tt.want {
				if got := results[i].(map[string]any)["resource"]; got != want {
					t.Fatalf("result %d: got %v want %q", i, got, want)
				}
			}
		})
	}
}

func TestPolicyReportProjectsAllowlistedResultFields(t *testing.T) {
	obj := node("id", "report")
	obj.SetKind("PolicyReport")
	obj.SetNamespace("work")
	obj.Object["scope"] = map[string]any{"kind": "Pod", "namespace": "work", "name": "a"}
	obj.Object["results"] = []any{map[string]any{
		"policy": "p", "rule": "r", "result": "fail", "severity": "high", "source": "kyverno", "scored": true,
		"timestamp": map[string]any{"seconds": int64(1_800_000_000), "nanos": int64(0)},
		"message":   "private-payload", "category": "private-payload", "properties": map[string]any{"value": "private-payload"},
	}}
	entry := Normalize(obj)["spec"].(map[string]any)["results"].([]any)[0].(map[string]any)
	want := map[string]any{"policy": "p", "rule": "r", "result": "fail", "resource": "Pod/work/a", "severity": "high", "source": "kyverno", "scored": true, "timestamp": "2027-01-15T08:00:00Z"}
	if len(entry) != len(want) {
		t.Fatalf("got %v want %v", entry, want)
	}
	for key, value := range want {
		if entry[key] != value {
			t.Fatalf("%s: got %v want %v", key, entry[key], value)
		}
	}
}

func TestPolicyReportSummaryAndHealth(t *testing.T) {
	for _, tt := range []struct {
		name    string
		summary map[string]any
		want    string
	}{
		{"pass only", map[string]any{"pass": int64(3)}, "Healthy"},
		{"warn", map[string]any{"pass": int64(3), "warn": int64(1)}, "Warning"},
		{"fail", map[string]any{"pass": int64(3), "fail": int64(1)}, "Error"},
		{"error", map[string]any{"pass": int64(3), "error": int64(1)}, "Error"},
		{"skip only", map[string]any{"skip": int64(2)}, "Unknown"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			obj := node("id", "report")
			obj.SetKind("PolicyReport")
			obj.SetNamespace("work")
			obj.Object["summary"] = tt.summary
			status := Normalize(obj)["status"].(map[string]any)
			if status["level"] != tt.want {
				t.Fatalf("got %v want %s", status["level"], tt.want)
			}
			for _, name := range []string{"pass", "fail", "warn", "error", "skip"} {
				want, ok := tt.summary[name]
				if !ok {
					want = int64(0)
				}
				if status[name] != want {
					t.Fatalf("%s: got %v want %v", name, status[name], want)
				}
			}
		})
	}
}
