package collection

import "k8s.io/apimachinery/pkg/runtime/schema"

type Kind struct {
	Path, Name string
	GVR        schema.GroupVersionResource
}

func kind(path, name, group, version, resource string) Kind {
	return Kind{path, name, schema.GroupVersionResource{Group: group, Version: version, Resource: resource}}
}

var Kinds = []Kind{
	kind("nodes", "Node", "", "v1", "nodes"),
	kind("namespaces", "Namespace", "", "v1", "namespaces"),
	kind("pods", "Pod", "", "v1", "pods"),
	kind("kube-ovn/vpc", "Vpc", "kubeovn.io", "v1", "vpcs"),
	kind("kube-ovn/subnet", "Subnet", "kubeovn.io", "v1", "subnets"),
	kind("deployments", "Deployment", "apps", "v1", "deployments"),
	kind("daemonsets", "DaemonSet", "apps", "v1", "daemonsets"),
	kind("statefulsets", "StatefulSet", "apps", "v1", "statefulsets"),
	kind("replicasets", "ReplicaSet", "apps", "v1", "replicasets"),
	kind("jobs", "Job", "batch", "v1", "jobs"),
	kind("cronjobs", "CronJob", "batch", "v1", "cronjobs"),
	kind("services", "Service", "", "v1", "services"),
	kind("ingresses", "Ingress", "networking.k8s.io", "v1", "ingresses"),
	kind("network-policies", "NetworkPolicy", "networking.k8s.io", "v1", "networkpolicies"),
	kind("configmaps", "ConfigMap", "", "v1", "configmaps"),
	kind("secrets", "Secret", "", "v1", "secrets"),
	kind("persistent-volumes", "PersistentVolume", "", "v1", "persistentvolumes"),
	kind("persistent-volume-claims", "PersistentVolumeClaim", "", "v1", "persistentvolumeclaims"),
	kind("rbac/roles", "Role", "rbac.authorization.k8s.io", "v1", "roles"),
	kind("rbac/role-bindings", "RoleBinding", "rbac.authorization.k8s.io", "v1", "rolebindings"),
	kind("rbac/service-accounts", "ServiceAccount", "", "v1", "serviceaccounts"),
	kind("kyverno/policies", "Policy", "kyverno.io", "v1", "policies"),
	kind("kyverno/policy-reports", "PolicyReport", "wgpolicyk8s.io", "v1alpha2", "policyreports"),
	kind("endpoint-slices", "EndpointSlice", "discovery.k8s.io", "v1", "endpointslices"),
	kind("kubernetes-events", "Event", "", "v1", "events"),
	kind("kube-ovn/ip", "IP", "kubeovn.io", "v1", "ips"),
	kind("kube-ovn/ip-pool", "IPPool", "kubeovn.io", "v1", "ippools"),
	kind("kube-ovn/nat-gateway", "VpcNatGateway", "kubeovn.io", "v1", "vpc-nat-gateways"),
	kind("kube-ovn/ovn-eip", "OvnEip", "kubeovn.io", "v1", "ovn-eips"),
	kind("kube-ovn/ovn-snat", "OvnSnatRule", "kubeovn.io", "v1", "ovn-snat-rules"),
	kind("kube-ovn/ovn-dnat", "OvnDnatRule", "kubeovn.io", "v1", "ovn-dnat-rules"),
	kind("kube-ovn/ovn-fip", "OvnFip", "kubeovn.io", "v1", "ovn-fips"),
	kind("kube-ovn/iptables-eip", "IptablesEIP", "kubeovn.io", "v1", "iptables-eips"),
	kind("kube-ovn/iptables-snat", "IptablesSnatRule", "kubeovn.io", "v1", "iptables-snat-rules"),
	kind("kube-ovn/iptables-dnat", "IptablesDnatRule", "kubeovn.io", "v1", "iptables-dnat-rules"),
	kind("kube-ovn/iptables-fip", "IptablesFIPRule", "kubeovn.io", "v1", "iptables-fip-rules"),
	kind("kube-ovn/provider-network", "ProviderNetwork", "kubeovn.io", "v1", "provider-networks"),
	kind("kube-ovn/vlan", "Vlan", "kubeovn.io", "v1", "vlans"),
	kind("kube-ovn/security-group", "SecurityGroup", "kubeovn.io", "v1", "security-groups"),
}

func UIKind(name string) string {
	switch name {
	case "Role", "RoleBinding", "ServiceAccount":
		return "Rbac" + name
	case "Policy":
		return "KyvernoPolicy"
	case "PolicyReport":
		return "KyvernoPolicyReport"
	}
	for _, kind := range Kinds {
		if kind.Name == name && kind.GVR.Group == "kubeovn.io" {
			return "KubeOvn" + name
		}
	}
	return name
}
