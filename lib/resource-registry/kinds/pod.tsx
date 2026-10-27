import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { ResourceLink } from "@/features/resource-explorer/components/ResourceLink";
import type { ColumnDef } from "@tanstack/react-table";
import { Box } from "lucide-react";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  K8sResource,
  ResourceList,
  ResourceListFilters,
} from "@/lib/api/types";
import type { ResourceTypeDefinition } from "@/lib/resource-registry/types";
import { StatusBadge } from "@/features/resource-explorer/components/StatusBadge";
import { TagList } from "@/features/resource-explorer/components/TagList";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";
import { formatAge } from "@/lib/utils/format";

export interface PodSpec {
  image: string;
  nodeName: string;
  containerCount: number;
}

export interface PodStatusExtra {
  phase: "Running" | "Pending" | "Succeeded" | "Failed" | "Unknown";
  restarts: number;
}

export type PodResource = K8sResource<PodSpec, PodStatusExtra>;

const KIND_PATH = "pods";

const columns: ColumnDef<PodResource>[] = [
  {
    accessorKey: "metadata.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.metadata.name}</span>
    ),
  },
  {
    accessorKey: "metadata.namespace",
    header: "Namespace",
    cell: ({ row }) => row.original.metadata.namespace ?? "-",
  },
  {
    id: "node",
    header: "Node",
    cell: ({ row }) => (
      <ResourceLink kind="Node" name={row.original.spec?.nodeName ?? ""} />
    ),
  },
  {
    id: "restarts",
    header: "Restarts",
    cell: ({ row }) => row.original.status.restarts,
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
}: {
  resource: PodResource;
  subContent?: unknown;
  isLoadingSub: boolean;
}) {
  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            {
              label: "Image",
              value: resource.spec?.image,
              mono: true,
              copy: resource.spec?.image,
            },
            {
              label: "Node",
              reference: { kind: "Node", name: resource.spec?.nodeName ?? "" },
            },
            { label: "Containers", value: resource.spec?.containerCount },
            { label: "Restarts", value: resource.status.restarts },
          ]}
        />
      </DetailSection>
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const podResourceType: ResourceTypeDefinition<PodResource> = {
  kind: "Pod",
  label: "Pod",
  icon: Box,
  columns,
  pollingIntervalMs: 8_000,
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<PodResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<PodResource>(endpoints.detail(KIND_PATH, namespace, name)),
  DetailRenderer,
};
