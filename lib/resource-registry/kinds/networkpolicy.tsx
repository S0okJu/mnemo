import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Filter } from "lucide-react";
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

export interface NetworkPolicySpec {
  podSelector: string;
  policyTypes: ("Ingress" | "Egress")[];
  ingressRules: number;
  egressRules: number;
}

export type NetworkPolicyResource = K8sResource<NetworkPolicySpec>;

const KIND_PATH = "network-policies";

const columns: ColumnDef<NetworkPolicyResource>[] = [
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
    id: "podSelector",
    header: "Pod Selector",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.spec?.podSelector}
      </span>
    ),
  },
  {
    id: "policyTypes",
    header: "Types",
    cell: ({ row }) => row.original.spec?.policyTypes.join(", "),
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
  resource: NetworkPolicyResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const affectedPods = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            {
              label: "Pod selector",
              value: resource.spec?.podSelector,
              mono: true,
            },
            {
              label: "Policy types",
              value: resource.spec?.policyTypes.join(", "),
            },
            { label: "Ingress rules", value: resource.spec?.ingressRules },
            { label: "Egress rules", value: resource.spec?.egressRules },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Selected by this policy",
            items: affectedPods.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No affected pods",
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

export const networkPolicyResourceType: ResourceTypeDefinition<NetworkPolicyResource> =
  {
    kind: "NetworkPolicy",
    label: "NetworkPolicy",
    icon: Filter,
    columns,
    pollingIntervalMs: 20_000,
    subContentLabel: "Affected pods",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<NetworkPolicyResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<NetworkPolicyResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "affected-pods"),
      ),
    DetailRenderer,
  };
