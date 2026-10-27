import type { ColumnDef } from "@tanstack/react-table";
import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type {
  K8sResource,
  ResourceList,
  ResourceListFilters,
} from "@/lib/api/types";

export interface ResourceEvent {
  message: string;
  time: string;
  reason?: string;
  type?: "Normal" | "Warning";
}

export interface DetailRendererProps<T> {
  resource: T;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}

export interface ResourceTypeDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends K8sResource<any, any> = K8sResource,
> {
  kind: string;
  label: string;
  icon: LucideIcon;
  columns: ColumnDef<T>[];
  pollingIntervalMs?: number;
  fetchList: (filters: ResourceListFilters) => Promise<ResourceList<T>>;
  fetchDetail: (namespace: string | undefined, name: string) => Promise<T>;
  fetchSubContent?: (
    namespace: string | undefined,
    name: string,
  ) => Promise<unknown>;
  subContentLabel?: string;
  fetchEvents?: (
    namespace: string | undefined,
    name: string,
  ) => Promise<ResourceEvent[]>;
  DetailRenderer: ComponentType<DetailRendererProps<T>>;
  /** One or two key facts shown in the detail header's metadata strip. */
  headerFacts?: (resource: T) => { label: string; value: ReactNode }[];
}
