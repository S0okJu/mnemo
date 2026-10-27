"use client";
import type {
  ResourceQueryResult,
  SubsystemKind,
} from "@/features/resource-explorer/types";
import type { ResourceStatusLevel } from "@/lib/api/types";
import { getResourceType } from "@/lib/resource-registry/registry";
import { useUrlState } from "@/features/resource-explorer/hooks/useUrlState";
import { resourceDetailHref } from "@/features/resource-explorer/lib/list-state";
import { componentNavigation } from "../registry/navigation";
import { ComponentOverview } from "./ComponentOverview";

export function SubsystemOverview({
  kinds,
  results,
}: {
  kinds: SubsystemKind[];
  results: ResourceQueryResult[];
}) {
  const { pathname, href } = useUrlState();
  const component = componentNavigation.find(
    (entry) => entry.basePath === pathname,
  );
  const listUrl = (kind: string, status?: ResourceStatusLevel) => {
    const params = new URLSearchParams({ type: kind, view: "resources" });
    if (status) params.set("status", status);
    return `${pathname}?${params}`;
  };
  return (
    <ComponentOverview
      title={`${component?.label ?? "Component"} overview`}
      description="Resource health and the items that need attention first."
      tiles={kinds.map(({ kind }, index) => {
        const definition = getResourceType(kind);
        const result = results[index];
        return {
          id: kind,
          label: definition.label,
          icon: definition.icon,
          statuses: result.data?.items.map((item) => item.status.level),
          href: listUrl(kind),
          statusHref: (level) => listUrl(kind, level),
          loading: result.isLoading,
          error: result.isError,
        };
      })}
      items={results.flatMap((result, index) =>
        (result.data?.items ?? []).map((resource) => ({
          resource,
          kindLabel: getResourceType(resource.kind).label,
          detailHref: resourceDetailHref(kinds[index].listHref, resource, href),
        })),
      )}
      failed={kinds
        .filter((_, index) => results[index].isError)
        .map(({ kind }) => getResourceType(kind).label)}
      loading={results.some((result) => result.isLoading)}
      isFetching={results.some((result) => result.isFetching)}
      dataUpdatedAt={Math.max(
        0,
        ...results.map((result) => result.dataUpdatedAt),
      )}
      onRefresh={() => results.forEach((result) => result.refetch())}
      listUrl={listUrl}
    />
  );
}
