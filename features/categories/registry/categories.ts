import { Boxes, Network, Database, ShieldCheck, Cable } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const categories: CategoryDefinition[] = [
  {
    id: "kubernetes",
    label: "Kubernetes",
    icon: Boxes,
  },
  { id: "cni", label: "CNI", icon: Cable },
  {
    id: "network",
    label: "Network",
    icon: Network,
  },
  {
    id: "storage",
    label: "Storage",
    icon: Database,
  },
  {
    id: "security",
    label: "Security & Governance",
    icon: ShieldCheck,
  },
];
