"use client";

import { useQuery } from "@tanstack/react-query";
import { getResourceType } from "@/lib/resource-registry/registry";
import { resourceKeys } from "@/lib/query/queryKeys";

export function useResourceDetail(
  kind: string,
  namespace: string | undefined,
  name: string | undefined,
  loadSubContent = true,
) {
  const resourceType = getResourceType(kind);
  const enabled = !!name;

  const detailQuery = useQuery({
    queryKey: resourceKeys.detail(kind, namespace, name ?? ""),
    queryFn: () => resourceType.fetchDetail(namespace, name!),
    enabled,
    retry: false,
    refetchInterval: resourceType.pollingIntervalMs,
  });

  const subQuery = useQuery({
    queryKey: resourceKeys.subContent(kind, namespace, name ?? "", "sub"),
    queryFn: () => resourceType.fetchSubContent!(namespace, name!),
    enabled: enabled && loadSubContent && !!resourceType.fetchSubContent,
    retry: false,
  });

  return {
    resourceType,
    resource: detailQuery.data,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    isErrorSub: subQuery.isError,
    subError: subQuery.error,
    refetchSub: subQuery.refetch,
    dataUpdatedAt: detailQuery.dataUpdatedAt,
    subContent: subQuery.data,
    isLoadingSub: subQuery.isLoading,
  };
}
