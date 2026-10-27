import { RuleTable } from "@/features/resource-explorer/components/RuleTable";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound } from "lucide-react";
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

export interface RbacRuleSpec {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface RbacRoleSpec {
  rules: RbacRuleSpec[];
}

export type RbacRoleResource = K8sResource<RbacRoleSpec>;

const KIND_PATH = "rbac/roles";

const columns: ColumnDef<RbacRoleResource>[] = [
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
    id: "rules",
    header: "Rules",
    cell: ({ row }) => row.original.spec?.rules.length ?? 0,
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
  resource: RbacRoleResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const relatedBindings = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Rules" count={resource.spec?.rules.length ?? 0}>
        <RuleTable rules={resource.spec?.rules ?? []} />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "RoleBinding",
            relation: "Binding this role",
            items: relatedBindings.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No related RoleBindings",
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

export const rbacRoleResourceType: ResourceTypeDefinition<RbacRoleResource> = {
  kind: "RbacRole",
  label: "Role",
  icon: KeyRound,
  columns,
  pollingIntervalMs: 20_000,
  subContentLabel: "Related RoleBindings",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<RbacRoleResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<RbacRoleResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(
      endpoints.subContent(KIND_PATH, namespace, name, "related"),
    ),
  DetailRenderer,
};
