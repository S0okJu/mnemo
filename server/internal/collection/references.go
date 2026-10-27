package collection

import (
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
)

type Reference struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name,omitempty"`
	UID       string `json:"uid,omitempty"`
	Method    string `json:"method"`
	Field     string `json:"field"`
	Relation  string `json:"relation"`
}

func References(obj *unstructured.Unstructured) []Reference {
	result := []Reference{}
	add := func(kind, namespace, name, field, relation string) {
		if name != "" {
			result = append(result, Reference{Kind: kind, Namespace: namespace, Name: name, Method: "binding-field", Field: field, Relation: relation})
		}
	}
	field := func(path string) string {
		value, _, _ := unstructured.NestedString(obj.Object, strings.Split(path, ".")...)
		return value
	}
	for _, owner := range obj.GetOwnerReferences() {
		if owner.UID != "" {
			result = append(result, Reference{Kind: owner.Kind, UID: string(owner.UID), Method: "ownerReference", Field: "metadata.ownerReferences", Relation: "owned-by"})
		}
	}
	if obj.GetNamespace() != "" {
		add("Namespace", "", obj.GetNamespace(), "metadata.namespace", "in-namespace")
	}
	ns := obj.GetNamespace()
	switch obj.GetKind() {
	case "Pod":
		add("Node", "", field("spec.nodeName"), "spec.nodeName", "scheduled-on")
		add("ServiceAccount", ns, field("spec.serviceAccountName"), "spec.serviceAccountName", "uses-service-account")
		volumes, _, _ := unstructured.NestedSlice(obj.Object, "spec", "volumes")
		for _, raw := range volumes {
			v, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			for _, ref := range []struct{ key, kind, name string }{{"persistentVolumeClaim", "PersistentVolumeClaim", "claimName"}, {"configMap", "ConfigMap", "name"}, {"secret", "Secret", "secretName"}} {
				entry, _ := v[ref.key].(map[string]any)
				name, _ := entry[ref.name].(string)
				add(ref.kind, ns, name, "spec.volumes."+ref.key, "uses")
			}
		}
		for _, containerType := range []string{"containers", "initContainers", "ephemeralContainers"} {
			containers, _, _ := unstructured.NestedSlice(obj.Object, "spec", containerType)
			for _, raw := range containers {
				c, ok := raw.(map[string]any)
				if !ok {
					continue
				}
				env, _ := c["env"].([]any)
				for _, rawEnv := range env {
					e, _ := rawEnv.(map[string]any)
					valueFrom, _ := e["valueFrom"].(map[string]any)
					for key, kind := range map[string]string{"secretKeyRef": "Secret", "configMapKeyRef": "ConfigMap"} {
						ref, _ := valueFrom[key].(map[string]any)
						name, _ := ref["name"].(string)
						add(kind, ns, name, "spec."+containerType+".env.valueFrom."+key, "uses")
					}
				}
				envFrom, _ := c["envFrom"].([]any)
				for _, rawEnv := range envFrom {
					e, _ := rawEnv.(map[string]any)
					for key, kind := range map[string]string{"secretRef": "Secret", "configMapRef": "ConfigMap"} {
						ref, _ := e[key].(map[string]any)
						name, _ := ref["name"].(string)
						add(kind, ns, name, "spec."+containerType+".envFrom."+key, "uses")
					}
				}
			}
		}
	case "PersistentVolumeClaim":
		add("PersistentVolume", "", field("spec.volumeName"), "spec.volumeName", "bound-to")
	case "PersistentVolume":
		add("PersistentVolumeClaim", field("spec.claimRef.namespace"), field("spec.claimRef.name"), "spec.claimRef", "bound-to")
	case "StatefulSet":
		add("Service", ns, field("spec.serviceName"), "spec.serviceName", "governed-by")
	case "RoleBinding":
		targetNS := ns
		if field("roleRef.kind") == "ClusterRole" {
			targetNS = ""
		}
		add(field("roleRef.kind"), targetNS, field("roleRef.name"), "roleRef", "binds-role")
		subjects, _, _ := unstructured.NestedSlice(obj.Object, "subjects")
		for _, raw := range subjects {
			subject, ok := raw.(map[string]any)
			if !ok || subject["kind"] != "ServiceAccount" {
				continue
			}
			name, _ := subject["name"].(string)
			namespace, _ := subject["namespace"].(string)
			if namespace == "" {
				namespace = ns
			}
			add("ServiceAccount", namespace, name, "subjects", "binds-subject")
		}
	case "Ingress":
		rules, _, _ := unstructured.NestedSlice(obj.Object, "spec", "rules")
		for _, raw := range rules {
			rule, _ := raw.(map[string]any)
			http, _ := rule["http"].(map[string]any)
			paths, _ := http["paths"].([]any)
			for _, rawPath := range paths {
				p, _ := rawPath.(map[string]any)
				backend, _ := p["backend"].(map[string]any)
				service, _ := backend["service"].(map[string]any)
				name, _ := service["name"].(string)
				add("Service", ns, name, "spec.rules.http.paths.backend.service.name", "routes-to")
			}
		}
	}
	if obj.GroupVersionKind().Group == "kubeovn.io" {
		for path, kind := range map[string]string{"spec.vpc": "Vpc", "spec.subnet": "Subnet", "spec.vpcSubnet": "Subnet", "spec.nodeName": "Node", "spec.namespace": "Namespace", "spec.ovnEip": "OvnEip", "spec.ipName": "IP", "spec.natGwDp": "VpcNatGateway", "spec.eip": "IptablesEIP", "spec.externalSubnet": "Subnet", "status.defaultLogicalSwitch": "Subnet"} {
			add(kind, "", field(path), path, "references")
		}
		if obj.GetKind() == "Vlan" {
			add("ProviderNetwork", "", field("spec.provider"), "spec.provider", "references")
		}
		add("Pod", field("spec.namespace"), field("spec.podName"), "spec.podName", "references")
		for _, path := range []string{"spec.namespaces", "status.subnets"} {
			values, _, _ := unstructured.NestedStringSlice(obj.Object, strings.Split(path, ".")...)
			kind := "Namespace"
			if path == "status.subnets" {
				kind = "Subnet"
			}
			for _, name := range values {
				add(kind, "", name, path, "references")
			}
		}
	}
	return result
}
func PodSelector(obj *unstructured.Unstructured) (labels.Selector, map[string]any, bool) {
	path := []string{"spec", "selector"}
	switch obj.GetKind() {
	case "Service":
		values, found, _ := unstructured.NestedStringMap(obj.Object, path...)
		if !found || len(values) == 0 {
			return nil, nil, false
		}
		return labels.SelectorFromSet(values), map[string]any{"matchLabels": values}, true
	case "NetworkPolicy":
		path = []string{"spec", "podSelector"}
	case "Deployment", "DaemonSet", "StatefulSet", "ReplicaSet":
	default:
		return nil, nil, false
	}
	raw, found, _ := unstructured.NestedMap(obj.Object, path...)
	if !found {
		return nil, nil, false
	}
	var selector metav1.LabelSelector
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw, &selector); err != nil {
		return nil, nil, false
	}
	compiled, err := metav1.LabelSelectorAsSelector(&selector)
	if err != nil {
		return nil, nil, false
	}
	return compiled, raw, true
}
