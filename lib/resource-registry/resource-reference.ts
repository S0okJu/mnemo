import { pluginResourceDefinitions } from "@/features/plugins/registry/plugins";

const resourcePaths: Record<string, string> = {
  ...Object.fromEntries(
    pluginResourceDefinitions.map((resource) => [
      resource.kind,
      `${resource.basePath}/resources/${resource.slug}`,
    ]),
  ),
  Node: "/kubernetes/node",
  Namespace: "/kubernetes/namespace",
  KyvernoPolicy: "/security/kyverno/policy",
  KyvernoPolicyReport: "/security/kyverno/policy-report",
  ConfigMap: "/kubernetes/config/configmap",
  Secret: "/kubernetes/config/secret",
  Pod: "/kubernetes/workload/pod",
  Deployment: "/kubernetes/workload/deployment",
  DaemonSet: "/kubernetes/workload/daemonset",
  StatefulSet: "/kubernetes/workload/statefulset",
  ReplicaSet: "/kubernetes/workload/replicaset",
  Job: "/kubernetes/workload/job",
  CronJob: "/kubernetes/workload/cronjob",
  Service: "/kubernetes/network/service",
  Ingress: "/kubernetes/network/ingress",
  NetworkPolicy: "/kubernetes/network/networkpolicy",
  RbacRole: "/kubernetes/rbac/role",
  RbacRoleBinding: "/kubernetes/rbac/role-binding",
  RbacServiceAccount: "/kubernetes/rbac/service-account",
  Role: "/kubernetes/rbac/role",
  RoleBinding: "/kubernetes/rbac/role-binding",
  ServiceAccount: "/kubernetes/rbac/service-account",
  PersistentVolume: "/storage/persistent-volume",
  PersistentVolumeClaim: "/storage/persistent-volume-claim",
};

export interface ResourceReference {
  kind?: string;
  name: string;
  namespace?: string;
}

/** Accept a name, namespace/name, or Kind/[namespace/]name when kind is omitted. */
export function resolveResourceReference({
  kind,
  name,
  namespace,
}: ResourceReference) {
  const parts = name.split("/");
  const resolvedKind = kind ?? parts.shift() ?? "";
  const rawName = parts.pop() ?? "";
  const resourceName =
    resolvedKind === "Service" ? rawName.split(":")[0] : rawName;
  const clusterScoped =
    pluginResourceDefinitions.some(
      (resource) =>
        resource.kind === resolvedKind && resource.scope === "Cluster",
    ) || ["PersistentVolume", "Node", "Namespace"].includes(resolvedKind);
  const resourceNamespace = clusterScoped
    ? undefined
    : (parts.pop() ?? namespace);
  const basePath = resourcePaths[resolvedKind];
  const href =
    basePath && resourceName && (resourceNamespace || clusterScoped)
      ? `${basePath}/${encodeURIComponent(resourceNamespace ?? "_")}/${encodeURIComponent(resourceName)}`
      : undefined;
  return {
    label:
      pluginResourceDefinitions.find(
        (resource) => resource.kind === resolvedKind,
      )?.label ?? resolvedKind.replace(/^Rbac/, ""),
    kind: resolvedKind,
    name: resourceName,
    namespace: resourceNamespace,
    href,
  };
}
