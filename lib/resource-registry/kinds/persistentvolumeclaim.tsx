import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Database } from "lucide-react";
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

export interface PersistentVolumeClaimSpec {
  storageClassName: string;
  accessModes: string[];
  requestedStorage: string;
}

export type PersistentVolumeClaimResource =
  K8sResource<PersistentVolumeClaimSpec>;

const KIND_PATH = "persistent-volume-claims";

const columns: ColumnDef<PersistentVolumeClaimResource>[] = [
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
    id: "storageClassName",
    header: "StorageClass",
    cell: ({ row }) => row.original.spec?.storageClassName,
  },
  {
    id: "requestedStorage",
    header: "Requested",
    cell: ({ row }) => row.original.spec?.requestedStorage,
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
}: {
  resource: PersistentVolumeClaimResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const mountedBy = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Requested", value: resource.spec?.requestedStorage },
            { label: "Storage class", value: resource.spec?.storageClassName },
            {
              label: "Access modes",
              value: resource.spec?.accessModes.join(", "),
            },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Mounting this claim",
            items: mountedBy.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "Not mounted by any pod",
            ...relatedSubState({ isLoadingSub, isErrorSub, refetchSub }),
          },
        ]}
      />
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const persistentVolumeClaimResourceType: ResourceTypeDefinition<PersistentVolumeClaimResource> =
  {
    kind: "PersistentVolumeClaim",
    label: "PersistentVolumeClaim",
    icon: Database,
    columns,
    pollingIntervalMs: 20_000,
    subContentLabel: "Mounted by",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<PersistentVolumeClaimResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<PersistentVolumeClaimResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "mounted-by"),
      ),
    DetailRenderer,
  };
