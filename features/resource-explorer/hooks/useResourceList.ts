"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getResourceType } from "@/lib/resource-registry/registry";
import { resourceKeys } from "@/lib/query/queryKeys";
import type { ResourceListFilters } from "@/lib/api/types";

export function useResourceList(
  kind: string,
  filters: ResourceListFilters = {},
) {
  const resourceType = getResourceType(kind);

  return useQuery({
    queryKey: resourceKeys.list(kind, filters),
    queryFn: () => resourceType.fetchList(filters),
    refetchInterval: resourceType.pollingIntervalMs,
    placeholderData: keepPreviousData,
  });
}
