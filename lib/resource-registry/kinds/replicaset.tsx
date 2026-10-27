import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy } from "lucide-react";
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

export interface ReplicaSetSpec {
  replicas: number;
  image: string;
  ownerDeployment?: string;
}

export interface ReplicaSetStatusExtra {
  readyReplicas: number;
}

export type ReplicaSetResource = K8sResource<
  ReplicaSetSpec,
  ReplicaSetStatusExtra
>;

const KIND_PATH = "replicasets";

const columns: ColumnDef<ReplicaSetResource>[] = [
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
    id: "replicas",
    header: "Replicas",
    cell: ({ row }) =>
      `${row.original.status.readyReplicas}/${row.original.spec?.replicas ?? 0}`,
  },
  {
    id: "owner",
    header: "Owner",
    cell: ({ row }) => row.original.spec?.ownerDeployment ?? "-",
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
  resource: ReplicaSetResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const pods = (subContent as string[] | undefined) ?? [];

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
              label: "Replicas",
              value: `${resource.status.readyReplicas}/${resource.spec?.replicas ?? 0} ready`,
            },
            {
              label: "Owner",
              reference: {
                kind: "Deployment",
                name: resource.spec?.ownerDeployment ?? "",
                namespace: resource.metadata.namespace,
              },
            },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Owned by this ReplicaSet",
            items: pods.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No owned pods",
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

export const replicaSetResourceType: ResourceTypeDefinition<ReplicaSetResource> =
  {
    kind: "ReplicaSet",
    label: "ReplicaSet",
    icon: Copy,
    columns,
    pollingIntervalMs: 10_000,
    subContentLabel: "Owned pods",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<ReplicaSetResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<ReplicaSetResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "pods"),
      ),
    DetailRenderer,
  };
