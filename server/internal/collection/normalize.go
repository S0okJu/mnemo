package collection

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sort"
	"strings"
)

// Normalize uses an allowlist; raw resource documents, annotation values,
// Secret values, container environment and ConfigMap data are never projected.
func Normalize(obj *unstructured.Unstructured) map[string]any {
	metadata := map[string]any{"name": obj.GetName(), "namespace": obj.GetNamespace(), "uid": string(obj.GetUID()), "createdAt": obj.GetCreationTimestamp().UTC().Format("2006-01-02T15:04:05Z"), "labels": obj.GetLabels()}
	if obj.GetNamespace() == "" {
		delete(metadata, "namespace")
	}
	spec := map[string]any{}
	status := map[string]any{"level": "Unknown"}
	copyField := func(target map[string]any, name string, path ...string) {
		if v, found, _ := unstructured.NestedFieldCopy(obj.Object, path...); found {
			target[name] = v
		}
	}
	switch obj.GetKind() {
	case "Node":
		roles := []string{}
		for key := range obj.GetLabels() {
			if strings.HasPrefix(key, "node-role.kubernetes.io/") {
				roles = append(roles, strings.TrimPrefix(key, "node-role.kubernetes.io/"))
			}
		}
		sort.Strings(roles)
		spec["roles"] = roles
		copyField(spec, "kubeletVersion", "status", "nodeInfo", "kubeletVersion")
		copyField(spec, "osImage", "status", "nodeInfo", "osImage")
		copyField(spec, "cpu", "status", "capacity", "cpu")
		copyField(spec, "memory", "status", "capacity", "memory")
		copyField(spec, "unschedulable", "spec", "unschedulable")
		addresses, _, _ := unstructured.NestedSlice(obj.Object, "status", "addresses")
		for _, address := range addresses {
			a, ok := address.(map[string]any)
			if ok && a["type"] == "InternalIP" {
				spec["internalIP"] = a["address"]
			}
		}
	case "Pod":
		copyField(spec, "nodeName", "spec", "nodeName")
		containers, _, _ := unstructured.NestedSlice(obj.Object, "spec", "containers")
		spec["containerCount"] = len(containers)
		if len(containers) > 0 {
			if c, ok := containers[0].(map[string]any); ok {
				spec["image"] = c["image"]
			}
		}
		phase, _, _ := unstructured.NestedString(obj.Object, "status", "phase")
		status["phase"] = phase
		switch phase {
		case "Running", "Succeeded":
			status["level"] = "Healthy"
		case "Pending":
			status["level"] = "Progressing"
		case "Failed":
			status["level"] = "Error"
		}
		restarts := int64(0)
		cs, _, _ := unstructured.NestedSlice(obj.Object, "status", "containerStatuses")
		for _, c := range cs {
			if entry, ok := c.(map[string]any); ok {
				if n, ok := entry["restartCount"].(int64); ok {
					restarts += n
				}
			}
		}
		status["restarts"] = restarts
	case "Namespace":
		copyField(status, "phase", "status", "phase")
		status["level"] = "Healthy"
	case "Vpc", "Subnet":
		for _, field := range []string{"vpc", "cidrBlock", "gateway", "protocol", "provider", "default", "excludeIps", "namespaces", "vlan", "natOutgoing", "private", "gatewayType", "gatewayNode", "subnets", "router", "standby", "enableLb", "enableExternal"} {
			copyField(spec, field, "spec", field)
		}
	}
	normalizeExtra(obj, spec, status)
	conditions, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	safe := []any{}
	for _, entry := range conditions {
		c, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		safe = append(safe, map[string]any{"type": c["type"], "status": c["status"], "reason": c["reason"]})
	}
	status["conditions"] = safe
	status["level"], status["message"] = Health(obj)
	return map[string]any{"kind": UIKind(obj.GetKind()), "apiVersion": obj.GetAPIVersion(), "metadata": metadata, "spec": spec, "status": status, "references": References(obj)}
}
