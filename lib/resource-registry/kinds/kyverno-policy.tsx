import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { RelatedPanel } from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { FileCheck2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { formatAge } from "@/lib/utils/format";

export interface KyvernoPolicySpec {
  rulesCount: number;
  validationFailureAction: "Enforce" | "Audit";
  background: boolean;
}

export type KyvernoPolicyResource = K8sResource<KyvernoPolicySpec>;

const KIND_PATH = "kyverno/policies";

const columns: ColumnDef<KyvernoPolicyResource>[] = [
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
    id: "action",
    header: "Validation",
    cell: ({ row }) => (
      <Badge variant="outline" className="font-normal">
        {row.original.spec?.validationFailureAction}
      </Badge>
    ),
  },
  {
    id: "rules",
    header: "Rules",
    cell: ({ row }) => row.original.spec?.rulesCount ?? 0,
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
  resource: KyvernoPolicyResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const matches =
    (subContent as { resource: string; result: string }[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            {
              label: "Validation",
              value: resource.spec?.validationFailureAction,
            },
            {
              label: "Background scan",
              value: resource.spec?.background ? "Enabled" : "Disabled",
            },
            { label: "Rules", value: resource.spec?.rulesCount },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        relation="Recent policy matches"
        detailLabel="Result"
        isLoading={isLoadingSub}
        errorMessage={isErrorSub ? "Unable to load related data" : undefined}
        onRetry={refetchSub}
        emptyMessage="No recent policy matches"
        items={matches.map((match) => ({
          name: match.resource,
          namespace: resource.metadata.namespace,
          detail: match.result,
        }))}
      />
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const kyvernoPolicyResourceType: ResourceTypeDefinition<KyvernoPolicyResource> =
  {
    kind: "KyvernoPolicy",
    label: "Policy",
    icon: FileCheck2,
    columns,
    pollingIntervalMs: 15_000,
    subContentLabel: "Recent policy matches",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<KyvernoPolicyResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<KyvernoPolicyResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "matches"),
      ),
    DetailRenderer,
  };
