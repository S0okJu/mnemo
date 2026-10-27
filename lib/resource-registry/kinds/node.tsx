import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import type { ColumnDef } from "@tanstack/react-table";
import { Server } from "lucide-react";
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

export interface NodeSpec {
  roles: string[];
  internalIP: string;
  kubeletVersion: string;
  osImage: string;
  cpu: string;
  memory: string;
  unschedulable: boolean;
}
export type NodeResource = K8sResource<NodeSpec>;

const columns: ColumnDef<NodeResource>[] = [
  {
    accessorKey: "metadata.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.metadata.name}</span>
    ),
  },
  {
    id: "roles",
    header: "Roles",
    cell: ({ row }) => row.original.spec?.roles.join(", "),
  },
  {
    id: "internal-ip",
    header: "Internal IP",
    cell: ({ row }) => row.original.spec?.internalIP,
  },
  {
    id: "version",
    header: "Version",
    cell: ({ row }) => row.original.spec?.kubeletVersion,
  },
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
}: DetailRendererProps<NodeResource>) {
  const related = (subContent as ResourceReference[] | undefined) ?? [];
  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Roles", value: resource.spec?.roles.join(", ") },
            {
              label: "Internal IP",
              value: resource.spec?.internalIP,
              mono: true,
              copy: resource.spec?.internalIP,
            },
            { label: "Kubelet version", value: resource.spec?.kubeletVersion },
            { label: "OS image", value: resource.spec?.osImage },
            { label: "CPU capacity", value: resource.spec?.cpu },
            { label: "Memory capacity", value: resource.spec?.memory },
            {
              label: "Scheduling",
              value: resource.spec?.unschedulable ? "Disabled" : "Enabled",
            },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        relation="Scheduled on this node"
        presentation="summary"
        items={related}
        isLoading={isLoadingSub}
        errorMessage={isErrorSub ? "Unable to load related data" : undefined}
        onRetry={refetchSub}
        emptyMessage="No pods scheduled on this node"
      />
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const nodeResourceType: ResourceTypeDefinition<NodeResource> = {
  kind: "Node",
  label: "Node",
  icon: Server,
  columns,
  pollingIntervalMs: 10000,
  fetchList: (filters) =>
    apiFetch<ResourceList<NodeResource>>(
      `${endpoints.list("nodes")}${toQueryString(filters)}`,
    ),
  fetchDetail: (_namespace, name) =>
    apiFetch<NodeResource>(endpoints.detail("nodes", undefined, name)),
  fetchSubContent: (_namespace, name) =>
    apiFetch<ResourceReference[]>(
      endpoints.subContent("nodes", undefined, name, "related"),
    ),
  DetailRenderer,
};
