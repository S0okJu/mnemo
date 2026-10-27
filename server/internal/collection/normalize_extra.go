package collection

import (
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
)

func normalizeExtra(obj *unstructured.Unstructured, spec, status map[string]any) {
	field := func(target map[string]any, name string, path ...string) {
		if value, ok, _ := unstructured.NestedFieldCopy(obj.Object, path...); ok {
			target[name] = value
		}
	}
	text := func(path ...string) string {
		value, _, _ := unstructured.NestedString(obj.Object, path...)
		return value
	}
	list := func(path ...string) []any {
		value, _, _ := unstructured.NestedSlice(obj.Object, path...)
		if value == nil {
			return []any{}
		}
		return value
	}
	image := func(path ...string) string {
		containers := list(path...)
		if len(containers) > 0 {
			if c, ok := containers[0].(map[string]any); ok {
				image, _ := c["image"].(string)
				return image
			}
		}
		return ""
	}
	switch obj.GetKind() {
	case "Namespace":
		field(spec, "phase", "status", "phase")
	case "Deployment", "DaemonSet", "StatefulSet", "ReplicaSet", "Job", "CronJob":
		template := []string{"spec", "template", "spec", "containers"}
		if obj.GetKind() == "CronJob" {
			template = []string{"spec", "jobTemplate", "spec", "template", "spec", "containers"}
		}
		spec["image"] = image(template...)
		for _, name := range []string{"replicas", "serviceName", "completions", "parallelism", "schedule", "suspend"} {
			field(spec, name, "spec", name)
		}
		if obj.GetKind() == "Deployment" {
			spec["strategy"] = text("spec", "strategy", "type")
			if spec["strategy"] == "" {
				spec["strategy"] = "RollingUpdate"
			}
		}
		for _, name := range []string{"readyReplicas", "availableReplicas", "active", "succeeded", "failed"} {
			status[name] = int64(0)
			field(status, name, "status", name)
		}
		for target, source := range map[string]string{"desired": "desiredNumberScheduled", "current": "currentNumberScheduled", "ready": "numberReady"} {
			status[target] = int64(0)
			field(status, target, "status", source)
		}
		if obj.GetKind() == "ReplicaSet" {
			for _, owner := range obj.GetOwnerReferences() {
				if owner.Kind == "Deployment" {
					spec["ownerDeployment"] = owner.Name
				}
			}
		}
	case "Service":
		field(spec, "selector", "spec", "selector")
		field(spec, "externalAddresses", "status", "loadBalancer", "ingress")
		field(spec, "type", "spec", "type")
		field(spec, "clusterIP", "spec", "clusterIP")
		spec["ports"] = list("spec", "ports")
	case "Ingress":
		spec["className"] = text("spec", "ingressClassName")
		rules := []any{}
		for _, raw := range list("spec", "rules") {
			rule, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			http, _ := rule["http"].(map[string]any)
			paths, _ := http["paths"].([]any)
			for _, rawPath := range paths {
				p, ok := rawPath.(map[string]any)
				if !ok {
					continue
				}
				backend, _ := p["backend"].(map[string]any)
				service, _ := backend["service"].(map[string]any)
				port, _ := service["port"].(map[string]any)
				portValue := port["number"]
				if portValue == nil {
					portValue = port["name"]
				}
				rules = append(rules, map[string]any{"host": rule["host"], "path": p["path"], "backendService": fmt.Sprint(service["name"]) + ":" + fmt.Sprint(portValue)})
			}
		}
		spec["rules"] = rules
	case "NetworkPolicy":
		selector, _, _ := unstructured.NestedStringMap(obj.Object, "spec", "podSelector", "matchLabels")
		spec["podSelector"] = labels.SelectorFromSet(selector).String()
		spec["policyTypes"] = list("spec", "policyTypes")
		spec["ingressRules"] = len(list("spec", "ingress"))
		spec["egressRules"] = len(list("spec", "egress"))
	case "ConfigMap":
		keys := []string{}
		for _, name := range []string{"data", "binaryData"} {
			data, _, _ := unstructured.NestedMap(obj.Object, name)
			for key := range data {
				keys = append(keys, key)
			}
		}
		sort.Strings(keys)
		spec["keys"] = keys
	case "Secret":
		spec["keys"] = []string{}
		spec["keysAvailable"] = false
	case "PersistentVolume", "PersistentVolumeClaim":
		spec["accessModes"] = list("spec", "accessModes")
		field(spec, "storageClassName", "spec", "storageClassName")
		field(spec, "capacity", "spec", "capacity", "storage")
		field(spec, "reclaimPolicy", "spec", "persistentVolumeReclaimPolicy")
		field(spec, "requestedStorage", "spec", "resources", "requests", "storage")
		field(status, "phase", "status", "phase")
	case "Role":
		spec["rules"] = list("rules")
	case "RoleBinding":
		spec["roleRef"] = text("roleRef", "kind") + "/" + text("roleRef", "name")
		spec["subjects"] = list("subjects")
	case "ServiceAccount":
		names := []string{}
		for _, entry := range list("secrets") {
			if ref, ok := entry.(map[string]any); ok {
				if name, ok := ref["name"].(string); ok {
					names = append(names, name)
				}
			}
		}
		spec["secrets"] = names
	case "Policy":
		spec["rulesCount"] = len(list("spec", "rules"))
		field(spec, "validationFailureAction", "spec", "validationFailureAction")
		field(spec, "background", "spec", "background")
	case "PolicyReport":
		scope := policyReportTarget(text("scope", "kind"), text("scope", "namespace"), text("scope", "name"))
		results := []any{}
		for _, raw := range list("results") {
			result, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			// Older reports list targets per result instead of a report-wide scope.
			targets := []string{}
			resources, _ := result["resources"].([]any)
			for _, rawResource := range resources {
				ref, ok := rawResource.(map[string]any)
				if !ok {
					continue
				}
				kind, _ := ref["kind"].(string)
				namespace, _ := ref["namespace"].(string)
				name, _ := ref["name"].(string)
				targets = append(targets, policyReportTarget(kind, namespace, name))
			}
			if len(targets) == 0 {
				targets = append(targets, scope)
			}
			for _, target := range targets {
				// message, properties and category are free text and stay out of the projection.
				entry := map[string]any{"policy": result["policy"], "rule": result["rule"], "result": result["result"], "resource": target}
				for _, name := range []string{"severity", "source", "scored"} {
					if value, ok := result[name]; ok {
						entry[name] = value
					}
				}
				if timestamp, ok := result["timestamp"].(map[string]any); ok {
					if seconds, ok := timestamp["seconds"].(int64); ok {
						entry["timestamp"] = time.Unix(seconds, 0).UTC().Format("2006-01-02T15:04:05Z")
					}
				}
				results = append(results, entry)
			}
		}
		spec["results"] = results

		spec["scope"] = text("scope", "kind")
		for _, name := range []string{"pass", "fail", "warn", "error", "skip"} {
			status[name] = int64(0)
			field(status, name, "summary", name)
		}
	case "EndpointSlice":
		sockets := []string{}
		ports := list("ports")
		for _, raw := range list("endpoints") {
			endpoint, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			conditions, _ := endpoint["conditions"].(map[string]any)
			if conditions["ready"] != true {
				continue
			}
			addresses, _ := endpoint["addresses"].([]any)
			for _, rawAddress := range addresses {
				address, ok := rawAddress.(string)
				if !ok {
					continue
				}
				for _, rawPort := range ports {
					port, _ := rawPort.(map[string]any)
					number, ok := port["port"].(int64)
					if ok {
						sockets = append(sockets, net.JoinHostPort(address, strconv.FormatInt(number, 10)))
					}
				}
			}
		}
		sort.Strings(sockets)
		spec["sockets"] = sockets
	case "Event":
		// Free-form event messages may contain literal workload credentials. Return
		// structured reason/type/time only; never persist the original message.
		reason := text("reason")
		if len(reason) > 128 || strings.IndexFunc(reason, func(r rune) bool {
			return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-')
		}) >= 0 {
			reason = "Event"
		}
		spec["message"] = reason
		spec["reason"] = reason
		spec["messageRedacted"] = true
		field(spec, "type", "type")
		field(spec, "involvedUID", "involvedObject", "uid")
		field(spec, "count", "count")
		timestamp := text("lastTimestamp")
		if timestamp == "" {
			timestamp = text("eventTime")
		}
		if timestamp == "" {
			timestamp = obj.GetCreationTimestamp().UTC().Format("2006-01-02T15:04:05Z")
		}
		spec["time"] = timestamp
	}
	if obj.GroupVersionKind().Group == "kubeovn.io" {
		for _, name := range []string{"vpc", "cidrBlock", "gateway", "protocol", "provider", "default", "excludeIps", "namespaces", "vlan", "natOutgoing", "private", "gatewayType", "gatewayNode", "enableLb", "enableExternal", "ipAddress", "subnet", "podName", "namespace", "nodeName", "ips", "lanIp", "externalSubnet", "v4Ip", "type", "ovnEip", "vpcSubnet", "ipName", "externalPort", "internalPort", "natGwDp", "v4ip", "eip", "internalCIDR", "internalIp", "defaultInterface", "id", "allowSameGroupTraffic", "ingressRules", "egressRules"} {
			field(spec, name, "spec", name)
		}
		for _, name := range []string{"defaultLogicalSwitch", "subnets", "v4usingIPs", "v4availableIPs", "v6usingIPs", "v6availableIPs", "readyNodes", "ready", "router", "standby"} {
			field(status, name, "status", name)
		}
	}
}

func policyReportTarget(kind, namespace, name string) string {
	if name == "" {
		return ""
	}
	if namespace == "" {
		return kind + "/" + name
	}
	return kind + "/" + namespace + "/" + name
}
