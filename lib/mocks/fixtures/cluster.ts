import { deployments } from "@/lib/mocks/fixtures/deployments";
import { daemonsets } from "@/lib/mocks/fixtures/daemonsets";
import { statefulsets } from "@/lib/mocks/fixtures/statefulsets";
import { replicasets } from "@/lib/mocks/fixtures/replicasets";
import { pods } from "@/lib/mocks/fixtures/pods";
import { jobs } from "@/lib/mocks/fixtures/jobs";
import { cronjobs } from "@/lib/mocks/fixtures/cronjobs";
import { services } from "@/lib/mocks/fixtures/services";
import { ingresses } from "@/lib/mocks/fixtures/ingresses";
import { networkpolicies } from "@/lib/mocks/fixtures/networkpolicies";
import { configmaps } from "@/lib/mocks/fixtures/configmaps";
import { secrets } from "@/lib/mocks/fixtures/secrets";
import { persistentvolumeclaims } from "@/lib/mocks/fixtures/persistentvolumeclaims";
import {
  kyvernoPolicies,
  kyvernoPolicyReports,
} from "@/lib/mocks/fixtures/kyverno";
import {
  rbacRoles,
  rbacRoleBindings,
  rbacServiceAccounts,
} from "@/lib/mocks/fixtures/rbac";
import type { K8sResource } from "@/lib/api/types";
import type { NodeResource } from "@/lib/resource-registry/kinds/node";
import type { NamespaceResource } from "@/lib/resource-registry/kinds/namespace";
import { daysAgo } from "@/lib/mocks/fixtures/helpers";

export function namespacedResources(): K8sResource<unknown, unknown>[] {
  return [
    ...deployments,
    ...daemonsets,
    ...statefulsets,
    ...replicasets,
    ...pods,
    ...jobs,
    ...cronjobs,
    ...services,
    ...ingresses,
    ...networkpolicies,
    ...configmaps,
    ...secrets,
    ...persistentvolumeclaims,
    ...kyvernoPolicies,
    ...kyvernoPolicyReports,
    ...rbacRoles,
    ...rbacRoleBindings,
    ...rbacServiceAccounts,
  ];
}

export const nodes: NodeResource[] = ["node-1", "node-2", "node-3"].map(
  (name, index) => ({
    kind: "Node",
    apiVersion: "v1",
    metadata: {
      name,
      uid: `node-${index}`,
      createdAt: daysAgo(120),
      labels: { "kubernetes.io/hostname": name, "kubernetes.io/os": "linux" },
    },
    spec: {
      roles: index === 0 ? ["control-plane"] : ["worker"],
      internalIP: `10.0.0.${index + 11}`,
      kubeletVersion: "v1.35.0",
      osImage: "Ubuntu 24.04 LTS",
      cpu: "8",
      memory: "32Gi",
      unschedulable: false,
    },
    status: {
      level: "Healthy",
      conditions: [{ type: "Ready", status: "True" }],
    },
  }),
);

const namespaceNames = new Set([
  "default",
  "kube-system",
  "kube-public",
  "kube-node-lease",
  ...namespacedResources().flatMap((resource) =>
    resource.metadata.namespace ? [resource.metadata.namespace] : [],
  ),
]);
export const namespaces: NamespaceResource[] = [...namespaceNames]
  .sort()
  .map((name) => ({
    kind: "Namespace",
    apiVersion: "v1",
    metadata: {
      name,
      uid: `namespace-${name}`,
      createdAt: daysAgo(120),
      labels: { "kubernetes.io/metadata.name": name },
    },
    spec: { phase: "Active" },
    status: { level: "Healthy" },
  }));
