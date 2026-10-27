import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { RuleTable } from "@/features/resource-explorer/components/RuleTable";
import { RelatedPanel } from "@/features/resource-explorer/components/related-panel";
import { ResourceLink } from "@/features/resource-explorer/components/ResourceLink";
import type { ColumnDef } from "@tanstack/react-table";
import { Link2 } from "lucide-react";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  K8sResource,
  ResourceList,
  ResourceListFilters,
} from "@/lib/api/types";
import type { ResourceTypeDefinition } from "@/lib/resource-registry/types";
import { StatusBadge } from "@/features/resource-explorer/components/StatusBadge";
import { AutoFetchedPanel } from "@/features/resource-explorer/components/AutoFetchedPanel";
import { TagList } from "@/features/resource-explorer/components/TagList";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";
import { formatAge } from "@/lib/utils/format";

export interface RbacSubjectSpec {
  kind: string;
  name: string;
  namespace?: string;
}

export interface RbacRoleBindingSpec {
  roleRef: string;
  subjects: RbacSubjectSpec[];
}

export type RbacRoleBindingResource = K8sResource<RbacRoleBindingSpec>;

const KIND_PATH = "rbac/role-bindings";

const columns: ColumnDef<RbacRoleBindingResource>[] = [
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
    id: "roleRef",
    header: "Role",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        <ResourceLink
          name={row.original.spec?.roleRef ?? ""}
          namespace={row.original.metadata.namespace}
        />
      </span>
    ),
  },
  {
    id: "subjects",
    header: "Subjects",
    cell: ({ row }) => row.original.spec?.subjects.length ?? 0,
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
  resource: RbacRoleBindingResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const roleRules =
    (subContent as { verbs: string[]; resources: string[] }[] | undefined) ??
    [];

  const role = {
    name: resource.spec?.roleRef ?? "",
    namespace: resource.metadata.namespace,
  };
  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Role", reference: role },
            {
              label: "Subjects",
              value: resource.spec?.subjects.length ?? 0,
            },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        exclude={[role]}
        relation="Subject of this binding"
        items={(resource.spec?.subjects ?? []).map((subject) => ({
          kind: subject.kind,
          name: subject.name,
          namespace: subject.namespace ?? resource.metadata.namespace,
        }))}
        emptyMessage="No subjects"
      />
      <AutoFetchedPanel
        label="Resolved role rules"
        isLoading={isLoadingSub}
        errorMessage={isErrorSub ? "Unable to load related data" : undefined}
        onRetry={refetchSub}
      >
        <RuleTable rules={roleRules} emptyMessage="No rules resolved" />
      </AutoFetchedPanel>
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const rbacRoleBindingResourceType: ResourceTypeDefinition<RbacRoleBindingResource> =
  {
    kind: "RbacRoleBinding",
    label: "RoleBinding",
    icon: Link2,
    columns,
    pollingIntervalMs: 20_000,
    subContentLabel: "Resolved role rules",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<RbacRoleBindingResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<RbacRoleBindingResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "role-rules"),
      ),
    DetailRenderer,
  };
