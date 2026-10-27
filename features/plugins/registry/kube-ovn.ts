import { Cable } from "lucide-react";

import type { PluginFieldRef, PluginResource } from "@/features/plugins/types";

/** Labels are the CRD's API Kind, as shown by kubectl and in YAML. */
const resource = (
  kind: string,
  slug: string,
  fields: [string, string, PluginFieldRef?][],
): PluginResource => ({
  kind: `KubeOvn${kind}`,
  label: kind,
  slug,
  apiPath: `kube-ovn/${slug}`,
  scope: "Cluster",
  fields: fields.map(([label, path, ref]) => ({ label, path, ref })),
});

const VPC = { kind: "KubeOvnVpc" };
const SUBNET = { kind: "KubeOvnSubnet" };

export const kubeOvnResources = [
  resource("Vpc", "vpc", [
    ["Default subnet", "status.defaultLogicalSwitch"],
    ["Subnets", "status.subnets"],
  ]),
  resource("Subnet", "subnet", [
    ["VPC", "spec.vpc", VPC],
    ["CIDR", "spec.cidrBlock"],
    ["Gateway", "spec.gateway"],
    ["Namespaces", "spec.namespaces"],
    ["Used IPv4", "status.v4usingIPs"],
    ["Available IPv4", "status.v4availableIPs"],
  ]),
  resource("IP", "ip", [
    ["Address", "spec.ipAddress"],
    ["Subnet", "spec.subnet", SUBNET],
    ["Pod", "spec.podName", { kind: "Pod", namespacePath: "spec.namespace" }],
    ["Namespace", "spec.namespace", { kind: "Namespace" }],
    ["Node", "spec.nodeName", { kind: "Node" }],
  ]),
  resource("IPPool", "ip-pool", [
    ["Subnet", "spec.subnet", SUBNET],
    ["IP ranges", "spec.ips"],
    ["Namespaces", "spec.namespaces"],
  ]),
  resource("VpcNatGateway", "nat-gateway", [
    ["VPC", "spec.vpc", VPC],
    ["Subnet", "spec.subnet", SUBNET],
    ["LAN IP", "spec.lanIp"],
  ]),
  resource("OvnEip", "ovn-eip", [
    ["External subnet", "spec.externalSubnet"],
    ["IPv4", "spec.v4Ip"],
    ["Type", "spec.type"],
  ]),
  resource("OvnSnatRule", "ovn-snat", [
    ["EIP", "spec.ovnEip", { kind: "KubeOvnOvnEip" }],
    ["Subnet", "spec.vpcSubnet", SUBNET],
    ["Internal IP", "spec.ipName", { kind: "KubeOvnIP" }],
  ]),
  resource("OvnDnatRule", "ovn-dnat", [
    ["EIP", "spec.ovnEip", { kind: "KubeOvnOvnEip" }],
    ["IP", "spec.ipName", { kind: "KubeOvnIP" }],
    ["External port", "spec.externalPort"],
    ["Internal port", "spec.internalPort"],
  ]),
  resource("OvnFip", "ovn-fip", [
    ["EIP", "spec.ovnEip", { kind: "KubeOvnOvnEip" }],
    ["IP", "spec.ipName", { kind: "KubeOvnIP" }],
  ]),
  resource("IptablesEIP", "iptables-eip", [
    ["NAT gateway", "spec.natGwDp", { kind: "KubeOvnVpcNatGateway" }],
    ["IPv4", "spec.v4ip"],
  ]),
  resource("IptablesSnatRule", "iptables-snat", [
    ["EIP", "spec.eip", { kind: "KubeOvnIptablesEIP" }],
    ["Internal CIDR", "spec.internalCIDR"],
  ]),
  resource("IptablesDnatRule", "iptables-dnat", [
    ["EIP", "spec.eip", { kind: "KubeOvnIptablesEIP" }],
    ["Internal IP", "spec.internalIp"],
    ["External port", "spec.externalPort"],
    ["Internal port", "spec.internalPort"],
  ]),
  resource("IptablesFIPRule", "iptables-fip", [
    ["EIP", "spec.eip", { kind: "KubeOvnIptablesEIP" }],
    ["Internal IP", "spec.internalIp"],
  ]),
  resource("ProviderNetwork", "provider-network", [
    ["Default interface", "spec.defaultInterface"],
    ["Ready nodes", "status.readyNodes"],
  ]),
  resource("Vlan", "vlan", [
    ["VLAN ID", "spec.id"],
    ["Provider network", "spec.provider", { kind: "KubeOvnProviderNetwork" }],
  ]),
  resource("SecurityGroup", "security-group", [
    ["Allow same group", "spec.allowSameGroupTraffic"],
    ["Ingress rules", "spec.ingressRules"],
    ["Egress rules", "spec.egressRules"],
  ]),
];

export const kubeOvnPlugin = {
  id: "kube-ovn",
  categoryId: "cni",
  name: "Kube-OVN",
  icon: Cable,
  description:
    "OVN-based networking: VPCs, subnets, IP allocation, NAT, underlay, and security.",
  core: false,
  basePath: "/cni/kube-ovn",
  resources: kubeOvnResources,
  sections: [
    {
      id: "overview",
      label: "Overview",
      description: "Network health, address capacity, and components",
      kinds: [],
    },
    {
      id: "networks",
      label: "Networks",
      description: "VPCs and subnets",
      kinds: ["KubeOvnVpc", "KubeOvnSubnet"],
    },
    {
      id: "ip-management",
      label: "IP Management",
      description: "IP allocation and address pools",
      kinds: ["KubeOvnIP", "KubeOvnIPPool"],
    },
    {
      id: "gateways",
      label: "Gateways & NAT",
      description: "NAT gateways and OVN / iptables address translation",
      kinds: [
        "KubeOvnVpcNatGateway",
        "KubeOvnOvnEip",
        "KubeOvnOvnSnatRule",
        "KubeOvnOvnDnatRule",
        "KubeOvnOvnFip",
        "KubeOvnIptablesEIP",
        "KubeOvnIptablesSnatRule",
        "KubeOvnIptablesDnatRule",
        "KubeOvnIptablesFIPRule",
      ],
    },
    {
      id: "underlay",
      label: "Underlay",
      description: "Provider networks and VLANs",
      kinds: ["KubeOvnProviderNetwork", "KubeOvnVlan"],
    },
    {
      id: "security",
      label: "Security",
      description: "Security groups and their related workloads",
      kinds: ["KubeOvnSecurityGroup"],
    },
  ],
};

export type KubeOvnCapability = {
  kind: string;
  available: boolean;
  permitted: boolean;
};

/** Why a Kube-OVN type cannot be opened, or undefined when it can. */
export function kubeOvnAvailability(
  kind: string,
  resources: KubeOvnCapability[],
) {
  const resource = resources.find((entry) => entry.kind === kind);
  return !resource?.available
    ? "Not installed or unsupported by this version"
    : !resource.permitted
      ? "Access denied"
      : undefined;
}

export function kubeOvnResourceHref(kind: string) {
  const definition = kubeOvnResources.find((entry) => entry.kind === kind);
  return definition
    ? `${kubeOvnPlugin.basePath}/resources/${definition.slug}`
    : undefined;
}

export function kubeOvnLabel(kind: string) {
  return kubeOvnResources.find((entry) => entry.kind === kind)?.label ?? kind;
}

export function kubeOvnSectionOf(kind: string) {
  return kubeOvnPlugin.sections.find((section) => section.kinds.includes(kind));
}

/** Flat local menu: every resource type under its feature heading. */
export function kubeOvnMenu(resources: KubeOvnCapability[]) {
  return [
    { id: "overview", label: "Overview", href: kubeOvnPlugin.basePath },
    ...kubeOvnPlugin.sections.flatMap((section) =>
      section.kinds.map((kind) => ({
        id: kind,
        label: kubeOvnLabel(kind),
        href: kubeOvnResourceHref(kind)!,
        group: section.label,
        disabled: kubeOvnAvailability(kind, resources),
      })),
    ),
  ];
}
