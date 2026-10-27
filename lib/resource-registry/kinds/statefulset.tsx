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

export interface StatefulSetSpec {
  replicas: number;
  serviceName: string;
  image: string;
}

export interface StatefulSetStatusExtra {
  readyReplicas: number;
}

export type StatefulSetResource = K8sResource<
  StatefulSetSpec,
  StatefulSetStatusExtra
>;

const KIND_PATH = "statefulsets";

const columns: ColumnDef<StatefulSetResource>[] = [
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
    id: "serviceName",
    header: "Service",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.spec?.serviceName}
      </span>
    ),
  },
  {
    id: "replicas",
    header: "Replicas",
    cell: ({ row }) =>
      `${row.original.status.readyReplicas}/${row.original.spec?.replicas ?? 0}`,
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
  resource: StatefulSetResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const sub = subContent as
    { pods: string[]; events: { message: string; time: string }[] } | undefined;
  const pods = sub?.pods ?? [];

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
              label: "Service",
              reference: {
                kind: "Service",
                name: resource.spec?.serviceName ?? "",
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
            relation: "Owned by this StatefulSet",
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

export const statefulSetResourceType: ResourceTypeDefinition<StatefulSetResource> =
  {
    kind: "StatefulSet",
    label: "StatefulSet",
    icon: Database,
    columns,
    pollingIntervalMs: 10_000,
    subContentLabel: "Related resources",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<StatefulSetResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<StatefulSetResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "related"),
      ),
    DetailRenderer,
  };
