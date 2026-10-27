import type { K8sResource, ResourceList } from "@/lib/api/types";
export interface SubsystemKind {
  kind: string;
  listHref: string;
}
export interface ResourceQueryResult {
  data?: ResourceList<K8sResource>;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  error: unknown;
  refetch: () => unknown;
}
