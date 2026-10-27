import { relatedResourceKind } from "../lib/related-resource-info";
import { kubeOvnResourceHref } from "@/features/plugins/registry/kube-ovn";

/**
 * Only registered resource adapters have working navigation destinations.
 * Menu labels are the resource's API Kind (singular), as shown by kubectl and in YAML.
 */
export const componentNavigation = [
  {
    id: "workload",
    label: "Workloads",
    basePath: "/kubernetes/workload",
    features: [
      ["Deployment", "Deployment"],
      ["DaemonSet", "DaemonSet"],
      ["StatefulSet", "StatefulSet"],
      ["Pod", "Pod"],
      ["ReplicaSet", "ReplicaSet"],
      ["Job", "Job"],
      ["CronJob", "CronJob"],
    ],
  },
  {
    id: "service",
    label: "Kubernetes Network",
    basePath: "/kubernetes/network",
    features: [
      ["Service", "Service"],
      ["Ingress", "Ingress"],
      ["NetworkPolicy", "NetworkPolicy"],
    ],
  },
  {
    id: "config",
    label: "Config",
    basePath: "/kubernetes/config",
    features: [
      ["ConfigMap", "ConfigMap"],
      ["Secret", "Secret"],
    ],
  },
  {
    id: "rbac",
    label: "RBAC",
    basePath: "/kubernetes/rbac",
    features: [
      ["RbacServiceAccount", "ServiceAccount"],
      ["RbacRole", "Role"],
      ["RbacRoleBinding", "RoleBinding"],
    ],
  },
  {
    id: "storage",
    label: "Volumes",
    basePath: "/storage",
    features: [
      ["PersistentVolume", "PersistentVolume"],
      ["PersistentVolumeClaim", "PersistentVolumeClaim"],
    ],
  },
  {
    id: "kyverno",
    label: "Kyverno",
    basePath: "/security",
    features: [
      ["KyvernoPolicy", "Policy"],
      ["KyvernoPolicyReport", "PolicyReport"],
    ],
  },
];

export function componentMenu(component: (typeof componentNavigation)[number]) {
  return [
    { id: "overview", label: "Overview", href: component.basePath },
    ...component.features.map(([id, label]) => ({
      id,
      label,
      href: `${component.basePath}?type=${encodeURIComponent(id)}&view=resources`,
    })),
  ];
}

/** List URL for a kind, with optional filters, or undefined when it has no list. */
export function kindListHref(
  kind: string,
  params: Record<string, string> = {},
) {
  const resolved = relatedResourceKind(kind);
  const component = componentNavigation.find((entry) =>
    entry.features.some(([id]) => id === resolved),
  );
  const query = new URLSearchParams(params);
  if (component) {
    query.set("type", resolved);
    query.set("view", "resources");
    return `${component.basePath}?${query}`;
  }
  const base =
    resolved === "Node"
      ? "/kubernetes/node"
      : resolved === "Namespace"
        ? "/kubernetes/namespace"
        : kubeOvnResourceHref(resolved);
  return base && `${base}${query.size ? `?${query}` : ""}`;
}
