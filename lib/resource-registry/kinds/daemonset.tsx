import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Rows3 } from "lucide-react";
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

export interface DaemonSetSpec {
  image: string;
}

export interface DaemonSetStatusExtra {
  desired: number;
  current: number;
  ready: number;
}

export type DaemonSetResource = K8sResource<
  DaemonSetSpec,
  DaemonSetStatusExtra
>;

const KIND_PATH = "daemonsets";

const columns: ColumnDef<DaemonSetResource>[] = [
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
    id: "desired",
    header: "Desired",
    cell: ({ row }) => row.original.status.desired,
  },
  {
    id: "ready",
    header: "Ready",
    cell: ({ row }) =>
      `${row.original.status.ready}/${row.original.status.current}`,
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
  resource: DaemonSetResource;
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
            { label: "Desired", value: resource.status.desired },
            { label: "Current", value: resource.status.current },
            { label: "Ready", value: resource.status.ready },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Owned by this DaemonSet",
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

export const daemonSetResourceType: ResourceTypeDefinition<DaemonSetResource> =
  {
    kind: "DaemonSet",
    label: "DaemonSet",
    icon: Rows3,
    columns,
    pollingIntervalMs: 10_000,
    subContentLabel: "Related resources",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<DaemonSetResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<DaemonSetResource>(endpoints.detail(KIND_PATH, namespace, name)),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "related"),
      ),
    DetailRenderer,
  };
