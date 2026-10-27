import {
  RelatedPanel,
  relatedSubState,
  groupByKind,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { UserCog } from "lucide-react";
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

export interface RbacServiceAccountSpec {
  secrets: string[];
}

export type RbacServiceAccountResource = K8sResource<RbacServiceAccountSpec>;

const KIND_PATH = "rbac/service-accounts";

const columns: ColumnDef<RbacServiceAccountResource>[] = [
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
    id: "secrets",
    header: "Secrets",
    cell: ({ row }) => row.original.spec?.secrets.length ?? 0,
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
  resource: RbacServiceAccountResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const boundRoles = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <RelatedPanel
        groups={[
          {
            kind: "Secret",
            relation: "Token secrets",
            items: (resource.spec?.secrets ?? []).map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No secrets bound to this service account",
          },
          ...(isLoadingSub || isErrorSub || boundRoles.length === 0
            ? [
                {
                  kind: "Role",
                  relation: "Bound through RoleBindings",
                  items: [],
                  emptyMessage: "No bound roles",
                  ...relatedSubState({ isLoadingSub, isErrorSub, refetchSub }),
                },
              ]
            : groupByKind(
                boundRoles.map((name) => ({
                  name,
                  namespace: resource.metadata.namespace,
                })),
                { relation: "Bound through RoleBindings" },
              )),
        ]}
      />
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const rbacServiceAccountResourceType: ResourceTypeDefinition<RbacServiceAccountResource> =
  {
    kind: "RbacServiceAccount",
    label: "ServiceAccount",
    icon: UserCog,
    columns,
    pollingIntervalMs: 20_000,
    subContentLabel: "Bound roles",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<RbacServiceAccountResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<RbacServiceAccountResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "bound-roles"),
      ),
    DetailRenderer,
  };
