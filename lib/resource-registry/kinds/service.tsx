import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import type { ColumnDef } from "@tanstack/react-table";
import { Network } from "lucide-react";
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

export interface ServicePort {
  port: number;
  targetPort: number;
  protocol: "TCP" | "UDP";
}

export interface ServiceSpec {
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  clusterIP: string;
  ports: ServicePort[];
}

export type ServiceResource = K8sResource<ServiceSpec>;

const KIND_PATH = "services";

function formatPorts(ports: ServicePort[]): string {
  return ports.map((p) => `${p.port}:${p.targetPort}/${p.protocol}`).join(", ");
}

const columns: ColumnDef<ServiceResource>[] = [
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
    cell: ({ row }) => row.original.spec?.type,
  },
  {
    id: "clusterIP",
    header: "ClusterIP",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.spec?.clusterIP}</span>
    ),
  },
  {
    id: "ports",
    header: "Ports",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {formatPorts(row.original.spec?.ports ?? [])}
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
  resource: ServiceResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const endpointsList = (subContent as string[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            { label: "Type", value: resource.spec?.type },
            {
              label: "Cluster IP",
              value: resource.spec?.clusterIP,
              mono: true,
              copy: resource.spec?.clusterIP,
            },
            {
              label: "Ports",
              value: formatPorts(resource.spec?.ports ?? []),
              mono: true,
            },
          ]}
        />
      </DetailSection>
      <AutoFetchedPanel
        label="Endpoints"
        isLoading={isLoadingSub}
        errorMessage={isErrorSub ? "Unable to load related data" : undefined}
        onRetry={refetchSub}
      >
        {endpointsList.length === 0 ? (
          <p className="text-muted-foreground text-sm">No ready endpoints</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {endpointsList.map((endpoint) => (
              <li
                key={endpoint}
                className="bg-muted/60 rounded-md px-2 py-1 font-mono text-xs"
              >
                {endpoint}
              </li>
            ))}
          </ul>
        )}
      </AutoFetchedPanel>
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const serviceResourceType: ResourceTypeDefinition<ServiceResource> = {
  kind: "Service",
  label: "Service",
  icon: Network,
  columns,
  pollingIntervalMs: 15_000,
  subContentLabel: "Endpoints",
  fetchList: (filters: ResourceListFilters) =>
    apiFetch<ResourceList<ServiceResource>>(
      `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
    ),
  fetchDetail: (namespace, name) =>
    apiFetch<ServiceResource>(endpoints.detail(KIND_PATH, namespace, name)),
  fetchSubContent: (namespace, name) =>
    apiFetch<unknown>(
      endpoints.subContent(KIND_PATH, namespace, name, "endpoints"),
    ),
  DetailRenderer,
};
