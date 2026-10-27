package collection

import (
	"fmt"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// Health reflects controller observations, never network traffic or inferred
// application correctness. Configuration objects have no runtime health signal.
func Health(obj *unstructured.Unstructured) (string, string) {
	text := func(path ...string) string {
		value, _, _ := unstructured.NestedString(obj.Object, path...)
		return value
	}
	number := func(path ...string) int64 { value, _, _ := unstructured.NestedInt64(obj.Object, path...); return value }
	boolean := func(path ...string) (bool, bool) {
		value, found, _ := unstructured.NestedBool(obj.Object, path...)
		return value, found
	}
	conditions, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	condition := func(name string) string {
		for _, raw := range conditions {
			entry, ok := raw.(map[string]any)
			if ok && entry["type"] == name {
				value, _ := entry["status"].(string)
				return value
			}
		}
		return ""
	}
	if obj.GetDeletionTimestamp() != nil {
		return "Progressing", "Deletion is in progress."
	}
	if condition("ReplicaFailure") == "True" || condition("Failed") == "True" || condition("FailureTarget") == "True" || condition("Error") == "True" {
		return "Error", "Controller reported a failure condition."
	}
	if obj.GetKind() == "Deployment" && condition("Progressing") == "False" {
		return "Error", "Deployment is not progressing."
	}
	switch obj.GetKind() {
	case "Node":
		if condition("Ready") == "False" {
			return "Error", "Node is not ready."
		}
		if condition("Ready") == "True" {
			for _, name := range []string{"MemoryPressure", "DiskPressure", "PIDPressure", "NetworkUnavailable"} {
				if condition(name) == "True" {
					return "Warning", "Node reports pressure or unavailable networking."
				}
			}
			return "Healthy", "Node is ready."
		}
		return "Unknown", "Node readiness has not been reported."
	case "Pod":
		phase := text("status", "phase")
		if phase == "Failed" {
			return "Error", "Pod failed."
		}
		if phase == "Succeeded" {
			return "Healthy", "Pod completed successfully."
		}
		for _, name := range []string{"initContainerStatuses", "containerStatuses"} {
			containers, _, _ := unstructured.NestedSlice(obj.Object, "status", name)
			for _, raw := range containers {
				entry, ok := raw.(map[string]any)
				if !ok {
					continue
				}
				state, _ := entry["state"].(map[string]any)
				waiting, _ := state["waiting"].(map[string]any)
				reason, _ := waiting["reason"].(string)
				switch reason {
				case "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "CreateContainerConfigError", "CreateContainerError", "RunContainerError":
					return "Error", "Container startup is failing."
				}
				terminated, _ := state["terminated"].(map[string]any)
				if code, ok := terminated["exitCode"].(int64); ok && code != 0 {
					return "Error", "Container exited unsuccessfully."
				}
			}
		}
		if phase == "Running" && condition("Ready") == "True" {
			return "Healthy", "Pod is running and ready."
		}
		if phase == "Running" || phase == "Pending" {
			return "Progressing", "Waiting for Pod readiness."
		}
		return "Unknown", "Pod phase/readiness has not been reported."
	case "Deployment", "ReplicaSet", "StatefulSet", "DaemonSet":
		if obj.GetGeneration() > 0 && number("status", "observedGeneration") < obj.GetGeneration() {
			return "Progressing", "Controller has not observed the latest configuration."
		}
		desired, found, _ := unstructured.NestedInt64(obj.Object, "spec", "replicas")
		if !found {
			desired = 1
		}
		ready := number("status", "readyReplicas")
		if obj.GetKind() == "DaemonSet" {
			var reported bool
			desired, reported, _ = unstructured.NestedInt64(obj.Object, "status", "desiredNumberScheduled")
			if !reported {
				return "Progressing", "DaemonSet scheduling has not been reported."
			}
			ready = number("status", "numberReady")
		}
		if desired == 0 {
			return "Healthy", "No replicas are currently requested."
		}
		if ready < desired {
			return "Progressing", fmt.Sprintf("%d/%d requested replicas are ready.", ready, desired)
		}
		if obj.GetKind() == "Deployment" && (number("status", "availableReplicas") < desired || number("status", "updatedReplicas") < desired) {
			return "Progressing", "Waiting for available, updated Deployment replicas."
		}
		if obj.GetKind() == "StatefulSet" && text("spec", "updateStrategy", "type") != "OnDelete" {
			partition := number("spec", "updateStrategy", "rollingUpdate", "partition")
			target := desired - partition
			if target < 0 {
				target = 0
			}
			if number("status", "updatedReplicas") < target {
				return "Progressing", "StatefulSet rollout has not reached its update target."
			}
		}
		return "Healthy", fmt.Sprintf("%d/%d requested replicas are ready.", ready, desired)
	case "Job":
		if condition("Complete") == "True" || condition("SuccessCriteriaMet") == "True" {
			return "Healthy", "Job completed successfully."
		}
		if suspended, _ := boolean("spec", "suspend"); suspended {
			return "Warning", "Job is suspended."
		}
		if number("status", "active") > 0 {
			return "Progressing", "Job is running."
		}
		completions, found, _ := unstructured.NestedInt64(obj.Object, "spec", "completions")
		if found && number("status", "succeeded") >= completions {
			return "Healthy", "Requested Job completions have succeeded."
		}
		return "Progressing", "Waiting for Job completion."
	case "CronJob":
		if suspended, _ := boolean("spec", "suspend"); suspended {
			return "Warning", "CronJob schedule is suspended."
		}
		active, _, _ := unstructured.NestedSlice(obj.Object, "status", "active")
		if len(active) > 0 {
			return "Progressing", "A scheduled Job is active."
		}
		success, err := time.Parse(time.RFC3339, text("status", "lastSuccessfulTime"))
		scheduled, e := time.Parse(time.RFC3339, text("status", "lastScheduleTime"))
		if err == nil && (e != nil || !success.Before(scheduled)) {
			return "Healthy", "Latest observed scheduled run succeeded."
		}
		return "Unknown", "Latest scheduled Job outcome has not been reported."
	case "Namespace":
		switch text("status", "phase") {
		case "Active":
			return "Healthy", "Namespace is active."
		case "Terminating":
			return "Progressing", "Namespace is terminating."
		}
		return "Unknown", "Namespace phase has not been reported."
	case "PersistentVolume", "PersistentVolumeClaim":
		switch text("status", "phase") {
		case "Bound", "Available":
			return "Healthy", "Storage binding is ready."
		case "Pending":
			return "Progressing", "Storage binding is pending."
		case "Released":
			return "Warning", "Volume is released and awaits reclamation."
		case "Lost", "Failed":
			return "Error", "Storage binding failed."
		}
		return "Unknown", "Storage phase has not been reported."
	case "Service":
		if text("spec", "type") == "ExternalName" {
			return "Unknown", "External DNS reachability is not observed."
		}
		if text("spec", "type") == "LoadBalancer" {
			addresses, _, _ := unstructured.NestedSlice(obj.Object, "status", "loadBalancer", "ingress")
			if len(addresses) == 0 {
				return "Progressing", "Waiting for a load balancer address."
			}
		}
		return "Unknown", "EndpointSlice readiness has not been collected."
	case "Ingress":
		addresses, _, _ := unstructured.NestedSlice(obj.Object, "status", "loadBalancer", "ingress")
		if len(addresses) > 0 {
			return "Healthy", "Ingress controller reported an address; traffic is not verified."
		}
	case "PolicyReport":
		if number("summary", "fail") > 0 || number("summary", "error") > 0 {
			return "Error", "Policy report contains failed or errored checks."
		}
		if number("summary", "warn") > 0 {
			return "Warning", "Policy report contains warnings."
		}
		if number("summary", "pass") > 0 {
			return "Healthy", "Reported policy checks passed."
		}
	case "ConfigMap", "Secret", "Role", "RoleBinding", "ServiceAccount", "Policy", "NetworkPolicy":
		return "Unknown", "Configuration/metadata object: no runtime readiness signal applies."
	}
	if condition("Validated") == "False" {
		return "Error", "Controller rejected resource validation."
	}
	if condition("Ready") == "False" {
		return "Progressing", "Controller readiness is pending."
	}
	if condition("Ready") == "True" {
		return "Healthy", "Controller reports the resource ready."
	}
	if ready, reported := boolean("status", "ready"); reported {
		if ready {
			return "Healthy", "Controller reports the resource ready."
		}
		return "Progressing", "Controller readiness is pending."
	}
	if strings.HasPrefix(obj.GetAPIVersion(), "kubeovn.io/") {
		return "Unknown", "This Kube-OVN kind has not reported a readiness signal."
	}
	return "Unknown", "Controller health has not been reported."
}
