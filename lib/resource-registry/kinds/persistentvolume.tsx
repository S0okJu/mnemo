import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { Skeleton } from "@/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { HardDrive } from "lucide-react";
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

export interface PersistentVolumeSpec {
  capacity: string;
  accessModes: string[];
  storageClassName: string;
  reclaimPolicy: "Retain" | "Delete" | "Recycle";
}

export type PersistentVolumeResource = K8sResource<PersistentVolumeSpec>;

const KIND_PATH = "persistent-volumes";

const columns: ColumnDef<PersistentVolumeResource>[] = [
  {
    accessorKey: "metadata.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.metadata.name}</span>
    ),
  },
  {
    id: "capacity",
    header: "Capacity",
    cell: ({ row }) => row.original.spec?.capacity,
  },
  {
    id: "accessModes",
    header: "Access Modes",
    cell: ({ row }) => row.original.spec?.accessModes.join(", "),
  },
  {
    id: "storageClassName",
    header: "StorageClass",
    cell: ({ row }) => row.original.spec?.storageClassName,
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
  resource: PersistentVolumeResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const boundClaim = subContent as string | null | undefined;

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Capacity", value: resource.spec?.capacity },
            {
              label: "Access modes",
              value: resource.spec?.accessModes.join(", "),
            },
            { label: "Storage class", value: resource.spec?.storageClassName },
            { label: "Reclaim policy", value: resource.spec?.reclaimPolicy },
            isLoadingSub
              ? {
                  label: "Claim",
                  value: <Skeleton className="h-4 w-32" />,
                }
              : isErrorSub
                ? {
                    label: "Claim",
                    value: (
                      <button
                        type="button"
                        onClick={() => refetchSub?.()}
                        className="text-destructive text-sm underline-offset-4 hover:underline"
                      >
                        Unable to load · Retry
                      </button>
                    ),
                  }
                : {
                    label: "Claim",
                    reference: {
                      kind: "PersistentVolumeClaim",
                      name: boundClaim ?? "",
                    },
                  },
          ]}
        />
      </DetailSection>
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const persistentVolumeResourceType: ResourceTypeDefinition<PersistentVolumeResource> =
  {
    kind: "PersistentVolume",
    label: "PersistentVolume",
    icon: HardDrive,
    columns,
    pollingIntervalMs: 20_000,
    subContentLabel: "Bound claim",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<PersistentVolumeResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<PersistentVolumeResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "bound-claim"),
      ),
    DetailRenderer,
  };
