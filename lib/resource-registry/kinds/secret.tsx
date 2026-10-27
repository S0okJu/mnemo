import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { KeyList } from "@/features/resource-explorer/components/KeyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";
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

export interface SecretSpec {
  type: string;
  keys: string[];
  keysAvailable?: boolean;
}

export type SecretResource = K8sResource<SecretSpec>;

const KIND_PATH = "secrets";

const columns: ColumnDef<SecretResource>[] = [
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
    id: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.spec?.type}</span>
    ),
  },
  {
    id: "keys",
    header: "Keys",
    cell: ({ row }) =>
      row.original.spec?.keysAvailable === false
        ? "Not collected"
        : (row.original.spec?.keys.length ?? 0),
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
  resource: SecretResource;
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
          items={[{ label: "Type", value: resource.spec?.type, mono: true }]}
        />
      </DetailSection>
      <DetailSection
        title="Keys"
        count={
          resource.spec?.keysAvailable === false
            ? undefined
            : (resource.spec?.keys.length ?? 0)
        }
      >
        <p className="text-muted-foreground -mt-1 text-xs">
          {resource.spec?.keysAvailable === false
            ? "Only Secret metadata is available. Key names and values are not collected."
            : "Values are never displayed."}
        </p>
        {resource.spec?.keysAvailable !== false && (
          <KeyList keys={resource.spec?.keys} masked />
        )}
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Mounting this Secret",
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

export const secretResourceType: ResourceTypeDefinition<SecretResource> = {
  kind: "Secret",
  label: "Secret",
  icon: Lock,
  columns,
  pollingIntervalMs: 30_000,
  subContentLabel: "Mounted by",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<SecretResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<SecretResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(
      endpoints.subContent(KIND_PATH, namespace, name, "mounted-by"),
    ),
  DetailRenderer,
};
