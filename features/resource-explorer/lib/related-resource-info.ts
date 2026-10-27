import {
  Box,
  Boxes,
  Cable,
  Clock3,
  Database,
  FileBox,
  FolderTree,
  KeyRound,
  Link2,
  Network,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { K8sResource } from "@/lib/api/types";
import { pluginResourceDefinitions } from "@/features/plugins/registry/plugins";
import { formatAge } from "@/lib/utils/format";

export function relatedResourceKind(kind: string) {
  return (
    (
      {
        Role: "RbacRole",
        RoleBinding: "RbacRoleBinding",
        ServiceAccount: "RbacServiceAccount",
      } as Record<string, string>
    )[kind] ?? kind
  );
}

/** Groups render owners first, then owned workloads, infrastructure, and config. */
export const RELATED_KIND_ORDER = [
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "CronJob",
  "Job",
  "ReplicaSet",
  "Pod",
  "Service",
  "Ingress",
  "NetworkPolicy",
  "Node",
  "Namespace",
  "PersistentVolume",
  "PersistentVolumeClaim",
  "ConfigMap",
  "Secret",
  "ServiceAccount",
  "Role",
  "RoleBinding",
];

const icons: Record<string, LucideIcon> = {
  Node: Server,
  Namespace: FolderTree,
  ConfigMap: FileBox,
  Secret: KeyRound,
  Pod: Box,
  Deployment: Boxes,
  DaemonSet: Boxes,
  StatefulSet: Boxes,
  ReplicaSet: Boxes,
  Job: Clock3,
  CronJob: Clock3,
  Service: Network,
  Ingress: Network,
  NetworkPolicy: ShieldCheck,
  Role: KeyRound,
  RoleBinding: Link2,
  ServiceAccount: KeyRound,
  PersistentVolume: Database,
  PersistentVolumeClaim: Database,
};

/** Icon shown once per related group, never per row. */
export function relatedKindIcon(kind: string): LucideIcon {
  return (
    icons[kind.replace(/^Rbac/, "")] ??
    (kind.startsWith("KubeOvn") ? Cable : FileBox)
  );
}

export function relatedKindRank(kind: string) {
  const index = RELATED_KIND_ORDER.indexOf(kind.replace(/^Rbac/, ""));
  return index === -1 ? RELATED_KIND_ORDER.length : index;
}

const fields: Record<string, [string, string][]> = {
  Pod: [
    ["Restarts", "status.restarts"],
    ["Node", "spec.nodeName"],
  ],
  Deployment: [
    ["Ready", "status.readyReplicas"],
    ["Replicas", "spec.replicas"],
  ],
  DaemonSet: [
    ["Ready", "status.ready"],
    ["Desired", "status.desired"],
  ],
  StatefulSet: [
    ["Ready", "status.readyReplicas"],
    ["Replicas", "spec.replicas"],
  ],
  ReplicaSet: [
    ["Ready", "status.readyReplicas"],
    ["Replicas", "spec.replicas"],
  ],
  Job: [
    ["Completions", "status.succeeded"],
    ["Desired", "spec.completions"],
  ],
  CronJob: [
    ["Schedule", "spec.schedule"],
    ["Suspended", "spec.suspend"],
  ],
  Node: [
    ["CPU", "spec.cpu"],
    ["Memory", "spec.memory"],
  ],
  Namespace: [["Phase", "status.phase"]],
  ConfigMap: [["Keys", "spec.keys"]],
  Secret: [
    ["Type", "spec.type"],
    ["Keys", "spec.keys"],
  ],
  Service: [
    ["Type", "spec.type"],
    ["Cluster IP", "spec.clusterIP"],
  ],
  Ingress: [["Hosts", "spec.hosts"]],
  NetworkPolicy: [
    ["Selector", "spec.podSelector"],
    ["Policy types", "spec.policyTypes"],
  ],
  RbacRole: [["Rules", "spec.rules"]],
  RbacRoleBinding: [
    ["Role", "spec.roleRef"],
    ["Subjects", "spec.subjects"],
  ],
  RbacServiceAccount: [["Tokens", "spec.secrets"]],
  PersistentVolume: [
    ["Capacity", "spec.capacity"],
    ["Storage class", "spec.storageClassName"],
  ],
  PersistentVolumeClaim: [
    ["Requested", "spec.requestedStorage"],
    ["Storage class", "spec.storageClassName"],
  ],
  KyvernoPolicy: [
    ["Action", "spec.validationFailureAction"],
    ["Rules", "spec.rulesCount"],
  ],
  KyvernoPolicyReport: [
    ["Pass", "status.pass"],
    ["Fail", "status.fail"],
  ],
};

// Collections whose size matters but whose contents must not be shown.
const COUNTED = ["Keys", "Rules", "Subjects", "Tokens"];
const NUMERIC = [
  ...COUNTED,
  "Restarts",
  "Ready",
  "Replicas",
  "Desired",
  "Completions",
  "Pass",
  "Fail",
];

export interface RelatedColumn {
  id: string;
  header: string;
  align?: "end";
  value: (resource: K8sResource) => string | undefined;
}

function read(resource: K8sResource, path: string) {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      resource,
    );
}

function format(label: string, value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value))
    return COUNTED.includes(label)
      ? String(value.length)
      : value.filter((item) => typeof item === "string").join(", ") ||
          undefined;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return undefined;
  return String(value);
}

/** Type-specific columns for a related-resource table, plus Age. */
export function relatedColumns(kind: string): RelatedColumn[] {
  const selected =
    pluginResourceDefinitions
      .find((definition) => definition.kind === kind)
      ?.fields.slice(0, 2)
      .map(({ label, path }) => [label, path] as [string, string]) ??
    fields[relatedResourceKind(kind)] ??
    [];
  return [
    ...selected.map(([label, path]) => ({
      id: path,
      header: label,
      align: NUMERIC.includes(label) ? ("end" as const) : undefined,
      value: (resource: K8sResource) => format(label, read(resource, path)),
    })),
    {
      id: "age",
      header: "Age",
      value: (resource) =>
        resource.metadata.createdAt
          ? formatAge(resource.metadata.createdAt)
          : undefined,
    },
  ];
}
