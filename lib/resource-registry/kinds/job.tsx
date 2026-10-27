import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckSquare } from "lucide-react";
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

export interface JobSpec {
  image: string;
  completions: number;
  parallelism: number;
}

export interface JobStatusExtra {
  active: number;
  succeeded: number;
  failed: number;
}

export type JobResource = K8sResource<JobSpec, JobStatusExtra>;

const KIND_PATH = "jobs";

const columns: ColumnDef<JobResource>[] = [
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
    id: "completions",
    header: "Completions",
    cell: ({ row }) =>
      `${row.original.status.succeeded}/${row.original.spec?.completions ?? 0}`,
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
  resource: JobResource;
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
            { label: "Active", value: resource.status.active },
            { label: "Succeeded", value: resource.status.succeeded },
            { label: "Failed", value: resource.status.failed },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Created by this Job",
            items: pods.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No pods",
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

export const jobResourceType: ResourceTypeDefinition<JobResource> = {
  kind: "Job",
  label: "Job",
  icon: CheckSquare,
  columns,
  pollingIntervalMs: 10_000,
  subContentLabel: "Pods",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<JobResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<JobResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(endpoints.subContent(KIND_PATH, namespace, name, "pods")),
  DetailRenderer,
};
