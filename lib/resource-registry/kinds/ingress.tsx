import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import { ResourceLink } from "@/features/resource-explorer/components/ResourceLink";
import type { ColumnDef } from "@tanstack/react-table";
import { Waypoints } from "lucide-react";
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

export interface IngressRule {
  host: string;
  path: string;
  backendService: string;
}

export interface IngressSpec {
  className: string;
  rules: IngressRule[];
}

export type IngressResource = K8sResource<IngressSpec>;

const KIND_PATH = "ingresses";

const columns: ColumnDef<IngressResource>[] = [
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
    id: "className",
    header: "Class",
    cell: ({ row }) => row.original.spec?.className,
  },
  {
    id: "hosts",
    header: "Hosts",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.spec?.rules.map((r) => r.host).join(", ")}
      </span>
    ),
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
  resource: IngressResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const relatedServices = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[{ label: "Ingress class", value: resource.spec?.className }]}
        />
      </DetailSection>
      <DetailSection title="Rules" count={resource.spec?.rules.length ?? 0}>
        {resource.spec?.rules.length ? (
          <ul className="divide-y rounded-lg border">
            {resource.spec.rules.map((rule, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs break-all">
                  {rule.host}
                  {rule.path}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span className="sr-only">routes to</span>
                <ResourceLink
                  kind="Service"
                  name={rule.backendService}
                  namespace={resource.metadata.namespace}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No rules</p>
        )}
      </DetailSection>
      <RelatedPanel
        exclude={(resource.spec?.rules ?? []).map((rule) => ({
          kind: "Service",
          name: rule.backendService,
          namespace: resource.metadata.namespace,
        }))}
        groups={[
          {
            kind: "Service",
            relation: "Routed by this Ingress",
            items: relatedServices.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No related services",
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

export const ingressResourceType: ResourceTypeDefinition<IngressResource> = {
  kind: "Ingress",
  label: "Ingress",
  icon: Waypoints,
  columns,
  pollingIntervalMs: 15_000,
  subContentLabel: "Related services",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<IngressResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<IngressResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(
      endpoints.subContent(KIND_PATH, namespace, name, "related-services"),
    ),
  DetailRenderer,
};
