"use client";

import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useResourceList } from "@/features/resource-explorer/hooks/useResourceList";
import {
  BreadcrumbHeader,
  type BreadcrumbSegment,
} from "@/features/resource-explorer/components/BreadcrumbHeader";
import { AutoUpdateIndicator } from "@/features/resource-explorer/components/AutoUpdateIndicator";
import { ResourceTable } from "@/features/resource-explorer/components/ResourceTable";
import { getResourceType } from "@/lib/resource-registry/registry";

export function ResourceExplorer({
  kind,
  breadcrumb,
  detailBasePath,
}: {
  kind: string;
  breadcrumb: BreadcrumbSegment[];
  detailBasePath: string;
}) {
  const router = useRouter();
  const resourceType = getResourceType(kind);

  const { data, isLoading, isFetching, dataUpdatedAt } = useResourceList(kind);

  function handleSelect(namespace: string | undefined, name: string) {
    const segment = `${namespace ? encodeURIComponent(namespace) : "_"}/${encodeURIComponent(name)}`;
    router.push(`${detailBasePath}/${segment}`);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <BreadcrumbHeader segments={breadcrumb} />
        </div>
        <AutoUpdateIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <ResourceTable
          columns={resourceType.columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyLabel={`No ${resourceType.label} resources match the current filters.`}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
