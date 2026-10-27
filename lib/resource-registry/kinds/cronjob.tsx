import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Timer } from "lucide-react";
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

export interface CronJobSpec {
  schedule: string;
  image: string;
  suspend: boolean;
}

export type CronJobResource = K8sResource<CronJobSpec>;

const KIND_PATH = "cronjobs";

const columns: ColumnDef<CronJobResource>[] = [
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
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.spec?.schedule}</span>
    ),
  },
  {
    id: "suspend",
    header: "Suspended",
    cell: ({ row }) => (row.original.spec?.suspend ? "Yes" : "No"),
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
  resource: CronJobResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const runs =
    (subContent as { name: string; time: string }[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Schedule", value: resource.spec?.schedule, mono: true },
            {
              label: "Image",
              value: resource.spec?.image,
              mono: true,
              copy: resource.spec?.image,
            },
            {
              label: "Suspended",
              value: resource.spec?.suspend ? "Yes" : "No",
            },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Job",
            relation: "Recent runs",
            detailLabel: "Started",
            items: runs.map((run) => ({
              name: run.name,
              namespace: resource.metadata.namespace,
              detail: `${formatAge(run.time)} ago`,
            })),
            emptyMessage: "No recent runs",
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

export const cronJobResourceType: ResourceTypeDefinition<CronJobResource> = {
  kind: "CronJob",
  label: "CronJob",
  icon: Timer,
  columns,
  pollingIntervalMs: 20_000,
  subContentLabel: "Recent runs",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<CronJobResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<CronJobResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(endpoints.subContent(KIND_PATH, namespace, name, "runs")),
  DetailRenderer,
};
