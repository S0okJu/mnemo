import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import type { PluginResource } from "@/features/plugins/types";
import { Cable } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { K8sResource, ResourceList } from "@/lib/api/types";
import type {
  DetailRendererProps,
  ResourceTypeDefinition,
} from "@/lib/resource-registry/types";
import type { ResourceReference } from "@/lib/resource-registry/resource-reference";
import { kubeOvnResources } from "@/features/plugins/registry/kube-ovn";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";
import { RelatedPanel } from "@/features/resource-explorer/components/related-panel";
import { StatusBadge } from "@/features/resource-explorer/components/StatusBadge";
import { TagList } from "@/features/resource-explorer/components/TagList";
import { formatAge } from "@/lib/utils/format";

export type KubeOvnResource = K8sResource<Record<string, unknown>>;

export function fieldValue(resource: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      resource,
    );
}
function display(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? value.map(display).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function createResourceType(
  definition: PluginResource,
): ResourceTypeDefinition<KubeOvnResource> {
  const columns: ColumnDef<KubeOvnResource>[] = [
    {
      accessorKey: "metadata.name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.metadata.name}</span>
      ),
    },
    ...definition.fields.slice(0, 3).map((field) => ({
      id: field.path,
      header: field.label,
      cell: ({ row }: { row: { original: KubeOvnResource } }) => (
        <span className="text-xs break-words">
          {display(fieldValue(row.original, field.path))}
        </span>
      ),
    })),
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
  }: DetailRendererProps<KubeOvnResource>) {
    // Fields that name another resource render as links and are not repeated in Related.
    function references(field: (typeof definition.fields)[number]) {
      if (!field.ref) return [];
      const raw = fieldValue(resource, field.path);
      const namespace = field.ref.namespacePath
        ? fieldValue(resource, field.ref.namespacePath)
        : undefined;
      return (Array.isArray(raw) ? raw : [raw])
        .filter((name): name is string => typeof name === "string" && !!name)
        .map((name) => ({
          kind: field.ref!.kind,
          name,
          namespace: typeof namespace === "string" ? namespace : undefined,
        }));
    }
    return (
      <div className="space-y-8">
        <DetailSection title="Summary">
          <PropertyList
            items={definition.fields.map((field) =>
              field.ref
                ? { label: field.label, reference: references(field) }
                : {
                    label: field.label,
                    value: display(fieldValue(resource, field.path)),
                  },
            )}
          />
        </DetailSection>
        <RelatedPanel
          exclude={definition.fields.flatMap(references)}
          isLoading={isLoadingSub}
          errorMessage={
            isErrorSub ? "Unable to load related resources" : undefined
          }
          onRetry={refetchSub}
          items={(subContent as ResourceReference[] | undefined) ?? []}
        />
        <DetailSection title="Labels">
          <TagList labels={resource.metadata.labels} />
        </DetailSection>
      </div>
    );
  }
  return {
    kind: definition.kind,
    label: definition.label,
    icon: Cable,
    columns,
    pollingIntervalMs: 10000,
    fetchList: (filters) =>
      apiFetch<ResourceList<KubeOvnResource>>(
        `${endpoints.list(definition.apiPath)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<KubeOvnResource>(
        endpoints.detail(definition.apiPath, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<ResourceReference[]>(
        endpoints.subContent(definition.apiPath, namespace, name, "related"),
      ),
    DetailRenderer,
  };
}
export const kubeOvnResourceTypes = Object.fromEntries(
  kubeOvnResources.map((definition) => [
    definition.kind,
    createResourceType(definition),
  ]),
);
