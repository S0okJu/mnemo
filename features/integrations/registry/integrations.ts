import { plugins } from "@/features/plugins/registry/plugins";
import {
  Boxes,
  Server,
  FolderTree,
  Waypoints,
  Route,
  FileCog,
  Database,
  HardDrive,
  KeyRound,
  FileCheck2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IntegrationDefinition {
  /** Matches a subsystem id referenced by a `SubsystemPage`'s `subsystemId`. */
  id: string;
  /** Matches a `CategoryDefinition.id` in `features/categories/registry/categories.ts`. */
  categoryId: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Core integrations are native Kubernetes resources — always on, not toggleable. */
  core: boolean;
  /** The subsystem's own route — used by the sidebar and by its SubsystemPage. */
  basePath: string;
}

export const integrations: IntegrationDefinition[] = [
  ...plugins,
  {
    id: "node",
    categoryId: "kubernetes",
    name: "Nodes",
    description: "Kubernetes cluster nodes, capacity, and scheduled Pods.",
    icon: Server,
    core: true,
    basePath: "/kubernetes/node",
  },
  {
    id: "namespace",
    categoryId: "kubernetes",
    name: "Namespaces",
    description: "Kubernetes namespaces and their resources.",
    icon: FolderTree,
    core: true,
    basePath: "/kubernetes/namespace",
  },
  {
    id: "workload",
    categoryId: "kubernetes",
    name: "Workloads",
    description:
      "Native Kubernetes workload resources: Pods, Deployments, DaemonSets, StatefulSets, ReplicaSets, Jobs, CronJobs.",
    icon: Boxes,
    core: true,
    basePath: "/kubernetes/workload",
  },
  {
    id: "service",
    categoryId: "kubernetes",
    name: "Kubernetes Network",
    description:
      "Native Kubernetes networking resources: Services, Ingresses, NetworkPolicies.",
    icon: Waypoints,
    core: true,
    basePath: "/kubernetes/network",
  },
  {
    id: "config",
    categoryId: "kubernetes",
    name: "Config",
    description:
      "Native Kubernetes configuration resources: ConfigMaps, Secrets.",
    icon: FileCog,
    core: true,
    basePath: "/kubernetes/config",
  },
  {
    id: "rbac",
    categoryId: "kubernetes",
    name: "RBAC",
    description:
      "Native Kubernetes role-based access control: Roles, RoleBindings, ServiceAccounts.",
    icon: KeyRound,
    core: true,
    basePath: "/kubernetes/rbac",
  },
  {
    id: "traefik",
    categoryId: "network",
    name: "Traefik",
    description:
      "Ingress controller and cloud-native application proxy for Kubernetes.",
    icon: Route,
    core: false,
    basePath: "/network/traefik",
  },
  {
    id: "storage",
    categoryId: "kubernetes",
    name: "Volumes",
    description:
      "Native Kubernetes storage resources: PersistentVolumes, PersistentVolumeClaims.",
    icon: Database,
    core: true,
    basePath: "/storage",
  },
  {
    id: "rook-ceph",
    categoryId: "storage",
    name: "Rook-Ceph",
    description:
      "Cloud-native storage orchestrator providing Ceph-backed block, file, and object storage.",
    icon: HardDrive,
    core: false,
    basePath: "/storage/rook-ceph",
  },
  {
    id: "kyverno",
    categoryId: "security",
    name: "Kyverno",
    description:
      "Kubernetes-native policy engine for validating, mutating, and generating resource configurations.",
    icon: FileCheck2,
    core: false,
    basePath: "/security",
  },
];
