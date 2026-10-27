import type { KubeOvnResource } from "@/lib/resource-registry/kinds/kube-ovn";
import type { ResourceReference } from "@/lib/resource-registry/resource-reference";
import { daysAgo } from "./helpers";
import { pods } from "./pods";
import { deployments } from "./deployments";
import { daemonsets } from "./daemonsets";
import { networkpolicies } from "./networkpolicies";
import { kubeOvnResources } from "@/features/plugins/registry/kube-ovn";

function resource(
  kind: string,
  name: string,
  spec: Record<string, unknown>,
  status: Record<string, unknown> = {},
): KubeOvnResource {
  return {
    kind: `KubeOvn${kind}`,
    apiVersion: "kubeovn.io/v1",
    metadata: {
      name,
      uid: `kube-ovn-${kind}-${name}`,
      createdAt: daysAgo(30),
      labels: { "app.kubernetes.io/managed-by": "kube-ovn" },
    },
    spec,
    status: { level: "Healthy", ...status },
  };
}
export const kubeOvnItems: KubeOvnResource[] = [
  resource(
    "Vpc",
    "ovn-cluster",
    {},
    {
      defaultLogicalSwitch: "ovn-default",
      subnets: ["ovn-default", "external-net"],
    },
  ),
  resource(
    "Vpc",
    "tenant-a",
    {},
    { defaultLogicalSwitch: "tenant-a-net", subnets: ["tenant-a-net"] },
  ),
  resource(
    "Subnet",
    "ovn-default",
    {
      vpc: "ovn-cluster",
      cidrBlock: "10.244.1.0/24",
      gateway: "10.244.1.1",
      namespaces: ["default", "mnemo-system"],
    },
    { v4usingIPs: 32, v4availableIPs: 221 },
  ),
  resource(
    "Subnet",
    "tenant-a-net",
    {
      vpc: "tenant-a",
      cidrBlock: "10.20.0.0/24",
      gateway: "10.20.0.254",
      namespaces: [],
    },
    {
      level: "Warning",
      message: "IPv4 address utilization exceeds 90%",
      v4usingIPs: 236,
      v4availableIPs: 17,
    },
  ),
  resource(
    "Subnet",
    "external-net",
    {
      vpc: "ovn-cluster",
      cidrBlock: "192.0.2.0/24",
      gateway: "192.0.2.1",
      vlan: "external-vlan",
      namespaces: [],
    },
    { v4usingIPs: 2, v4availableIPs: 251 },
  ),
  resource("IP", "mnemo-api-allocation", {
    ipAddress: "10.244.1.12",
    subnet: "ovn-default",
    podName: "mnemo-api-7f9c8d-x2k9p",
    namespace: "mnemo-system",
    nodeName: "node-1",
  }),
  resource("IP", "tenant-client-allocation", {
    ipAddress: "10.20.0.10",
    subnet: "tenant-a-net",
    podName: "tenant-client-0",
    namespace: "default",
    nodeName: "node-2",
  }),
  resource("IPPool", "app-pool", {
    subnet: "ovn-default",
    ips: ["10.244.1.10..10.244.1.100"],
    namespaces: ["mnemo-system"],
  }),
  resource("VpcNatGateway", "tenant-a-gateway", {
    vpc: "tenant-a",
    subnet: "tenant-a-net",
    lanIp: "10.20.0.254",
  }),
  resource("OvnEip", "tenant-ovn-eip", {
    externalSubnet: "external-net",
    v4Ip: "192.0.2.10",
    type: "nat",
  }),
  resource("OvnSnatRule", "tenant-ovn-snat", {
    ovnEip: "tenant-ovn-eip",
    vpcSubnet: "tenant-a-net",
  }),
  resource("OvnDnatRule", "tenant-ovn-dnat", {
    ovnEip: "tenant-ovn-eip",
    ipName: "tenant-client-allocation",
    externalPort: "443",
    internalPort: "8443",
    protocol: "tcp",
  }),
  resource("OvnFip", "tenant-ovn-fip", {
    ovnEip: "tenant-ovn-eip",
    ipName: "tenant-client-allocation",
  }),
  resource("IptablesEIP", "tenant-iptables-eip", {
    natGwDp: "tenant-a-gateway",
    v4ip: "192.0.2.11",
    externalSubnet: "external-net",
  }),
  resource("IptablesSnatRule", "tenant-iptables-snat", {
    eip: "tenant-iptables-eip",
    internalCIDR: "10.20.0.0/24",
  }),
  resource("IptablesDnatRule", "tenant-iptables-dnat", {
    eip: "tenant-iptables-eip",
    internalIp: "10.20.0.10",
    externalPort: "80",
    internalPort: "8080",
  }),
  resource("IptablesFIPRule", "tenant-iptables-fip", {
    eip: "tenant-iptables-eip",
    internalIp: "10.20.0.10",
  }),
  resource(
    "ProviderNetwork",
    "provider-eth1",
    { defaultInterface: "eth1" },
    { readyNodes: ["node-1", "node-2", "node-3"] },
  ),
  resource("Vlan", "external-vlan", { id: 100, provider: "provider-eth1" }),
  resource("SecurityGroup", "app-security", {
    allowSameGroupTraffic: true,
    ingressRules: [
      {
        protocol: "tcp",
        priority: 100,
        policy: "allow",
        portRangeMin: 443,
        portRangeMax: 443,
      },
    ],
    egressRules: [],
  }),
];

if (
  !pods.some(
    (pod) =>
      pod.metadata.name === "tenant-client-0" &&
      pod.metadata.namespace === "default",
  )
) {
  pods.push({
    ...pods[0],
    metadata: {
      name: "tenant-client-0",
      namespace: "default",
      uid: "pod-tenant-client-0",
      createdAt: daysAgo(3),
      labels: { app: "tenant-client" },
      annotations: {
        "ovn.kubernetes.io/logical_switch": "tenant-a-net",
        "ovn.kubernetes.io/security_groups": "app-security",
      },
    },
    spec: { image: "nginx:1.28", nodeName: "node-2", containerCount: 1 },
    status: { level: "Healthy", phase: "Running", restarts: 0 },
  });
}

export const kubeOvnRelations: Record<string, ResourceReference[]> = {};
const key = (kind: string, name: string) => `${kind}/${name}`;
function connect(a: ResourceReference, b: ResourceReference) {
  (kubeOvnRelations[key(a.kind!, a.name)] ??= []).push(b);
  if (b.kind?.startsWith("KubeOvn"))
    (kubeOvnRelations[key(b.kind, b.name)] ??= []).push(a);
}
const ref = (kind: string, name: string): ResourceReference => ({
  kind: `KubeOvn${kind}`,
  name,
});
for (const item of kubeOvnItems) {
  const self = { kind: item.kind, name: item.metadata.name };
  const spec = item.spec ?? {};
  const relationFields: [string, string][] = [
    ["vpc", "Vpc"],
    ["subnet", "Subnet"],
    ["vpcSubnet", "Subnet"],
    ["externalSubnet", "Subnet"],
    ["vlan", "Vlan"],
    ["provider", "ProviderNetwork"],
    ["ovnEip", "OvnEip"],
    ["ipName", "IP"],
    ["natGwDp", "VpcNatGateway"],
  ];
  if (item.kind.includes("Iptables") && spec.eip)
    connect(self, ref("IptablesEIP", String(spec.eip)));
  for (const [field, kind] of relationFields)
    if (typeof spec[field] === "string")
      connect(self, ref(kind, String(spec[field])));
  if (Array.isArray(spec.namespaces))
    for (const name of spec.namespaces)
      connect(self, { kind: "Namespace", name: String(name) });
  if (spec.podName)
    connect(self, {
      kind: "Pod",
      name: String(spec.podName),
      namespace: String(spec.namespace),
    });
  if (spec.namespace)
    connect(self, { kind: "Namespace", name: String(spec.namespace) });
  if (spec.nodeName)
    connect(self, { kind: "Node", name: String(spec.nodeName) });
  if (Array.isArray(item.status.readyNodes))
    for (const name of item.status.readyNodes)
      connect(self, { kind: "Node", name: String(name) });
}
connect(ref("SecurityGroup", "app-security"), {
  kind: "Pod",
  name: "tenant-client-0",
  namespace: "default",
});
const policy = networkpolicies.find(
  (item) => item.metadata.namespace === "default",
);
if (policy)
  connect(ref("SecurityGroup", "app-security"), {
    kind: "NetworkPolicy",
    name: policy.metadata.name,
    namespace: policy.metadata.namespace,
  });

// Kube-OVN workloads in kube-system, so the core Workloads views include them.
for (const [name] of [
  ["kube-ovn-controller", "Control plane"],
  ["ovn-central", "Control plane"],
  ["kube-ovn-monitor", "Observability"],
]) {
  let item = deployments.find(
    (item) =>
      item.metadata.name === name && item.metadata.namespace === "kube-system",
  );
  if (!item) {
    item = {
      kind: "Deployment",
      apiVersion: "apps/v1",
      metadata: {
        name,
        namespace: "kube-system",
        uid: `deploy-${name}`,
        createdAt: daysAgo(30),
        labels: { "app.kubernetes.io/part-of": "kube-ovn" },
      },
      spec: {
        image: `kubeovn/kube-ovn:v1.15.0`,
        replicas: 3,
        strategy: "RollingUpdate",
      },
      status: { level: "Healthy", readyReplicas: 3, availableReplicas: 3 },
    };
    deployments.push(item);
  }
}
for (const [name] of [
  ["kube-ovn-cni", "Node agents"],
  ["ovs-ovn", "Node agents"],
  ["kube-ovn-pinger", "Observability"],
  ["kube-ovn-speaker", "Node agents"],
]) {
  let item = daemonsets.find(
    (item) =>
      item.metadata.name === name && item.metadata.namespace === "kube-system",
  );
  if (!item) {
    item = {
      kind: "DaemonSet",
      apiVersion: "apps/v1",
      metadata: {
        name,
        namespace: "kube-system",
        uid: `daemonset-${name}`,
        createdAt: daysAgo(30),
        labels: { "app.kubernetes.io/part-of": "kube-ovn" },
      },
      spec: { image: "kubeovn/kube-ovn:v1.15.0" },
      status: {
        desired: 3,
        current: 3,
        level: name === "kube-ovn-pinger" ? "Warning" : "Healthy",
        ready: name === "kube-ovn-pinger" ? 2 : 3,
      },
    };
    daemonsets.push(item);
  }
}
export const kubeOvnMockCapabilities = {
  installed: true,
  version: "v1.15.0",
  source: "mock" as const,
  resources: kubeOvnResources.map((resource) => ({
    kind: resource.kind,
    available: true,
    permitted: true,
  })),
};
