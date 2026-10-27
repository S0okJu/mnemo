import { KeyList } from "@/features/resource-explorer/components/KeyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { FileCog } from "lucide-react";
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

export interface ConfigMapSpec {
  keys: string[];
}

export type ConfigMapResource = K8sResource<ConfigMapSpec>;

const KIND_PATH = "configmaps";

const columns: ColumnDef<ConfigMapResource>[] = [
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
    id: "keys",
    header: "Keys",
    cell: ({ row }) => row.original.spec?.keys.length ?? 0,
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
  resource: ConfigMapResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const mountedBy = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Keys" count={resource.spec?.keys.length ?? 0}>
        <KeyList keys={resource.spec?.keys} />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Mounting this ConfigMap",
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

export const configMapResourceType: ResourceTypeDefinition<ConfigMapResource> =
  {
    kind: "ConfigMap",
    label: "ConfigMap",
    icon: FileCog,
    columns,
    pollingIntervalMs: 30_000,
    subContentLabel: "Mounted by",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<ConfigMapResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<ConfigMapResource>(endpoints.detail(KIND_PATH, namespace, name)),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "mounted-by"),
      ),
    DetailRenderer,
  };
