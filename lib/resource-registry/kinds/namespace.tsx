import { kindListHref } from "@/features/resource-explorer/registry/navigation";
import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import type { ColumnDef } from "@tanstack/react-table";
import { FolderTree } from "lucide-react";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { K8sResource, ResourceList } from "@/lib/api/types";
import type {
  ResourceTypeDefinition,
  DetailRendererProps,
} from "@/lib/resource-registry/types";
import type { ResourceReference } from "@/lib/resource-registry/resource-reference";
import { StatusBadge } from "@/features/resource-explorer/components/StatusBadge";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";
import { TagList } from "@/features/resource-explorer/components/TagList";
import { RelatedPanel } from "@/features/resource-explorer/components/related-panel";
import { formatAge } from "@/lib/utils/format";

export interface NamespaceSpec {
  phase: "Active" | "Terminating";
}
export type NamespaceResource = K8sResource<NamespaceSpec>;

const columns: ColumnDef<NamespaceResource>[] = [
  {
    accessorKey: "metadata.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.metadata.name}</span>
    ),
  },
  { id: "phase", header: "Phase", cell: ({ row }) => row.original.spec?.phase },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge level={row.original.status.level} />,
  },
  {
    id: "age",
    header: "Age",
    cell: ({ row }) => formatAge(row.original.metadata.createdAt),
  },
];
function DetailRenderer({
  resource,
  subContent,
  isLoadingSub,
  isErrorSub,
  refetchSub,
}: DetailRendererProps<NamespaceResource>) {
  const related = (subContent as ResourceReference[] | undefined) ?? [];
  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Phase", value: resource.spec?.phase },
            { label: "Scope", value: "Cluster scoped" },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        relation="In this namespace"
        presentation="summary"
        listHref={(kind) =>
          kindListHref(kind, { namespace: resource.metadata.name })
        }
        items={related}
        isLoading={isLoadingSub}
        errorMessage={isErrorSub ? "Unable to load related data" : undefined}
        onRetry={refetchSub}
        emptyMessage="No resources in this namespace"
      />
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const namespaceResourceType: ResourceTypeDefinition<NamespaceResource> =
  {
    kind: "Namespace",
    label: "Namespace",
    icon: FolderTree,
    columns,
    pollingIntervalMs: 10000,
    fetchList: (filters) =>
      apiFetch<ResourceList<NamespaceResource>>(
        `${endpoints.list("namespaces")}${toQueryString(filters)}`,
      ),
    fetchDetail: (_namespace, name) =>
      apiFetch<NamespaceResource>(
        endpoints.detail("namespaces", undefined, name),
      ),
    fetchSubContent: (_namespace, name) =>
      apiFetch<ResourceReference[]>(
        endpoints.subContent("namespaces", undefined, name, "related"),
      ),
    DetailRenderer,
  };
