import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  RelatedPanel,
  relatedSubState,
} from "@/features/resource-explorer/components/related-panel";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers } from "lucide-react";
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

export interface DeploymentSpec {
  replicas: number;
  strategy: "RollingUpdate" | "Recreate";
  image: string;
}

export interface DeploymentStatusExtra {
  readyReplicas: number;
  availableReplicas: number;
}

export type DeploymentResource = K8sResource<
  DeploymentSpec,
  DeploymentStatusExtra
>;

const KIND_PATH = "deployments";

const columns: ColumnDef<DeploymentResource>[] = [
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
    id: "replicas",
    header: "Replicas",
    cell: ({ row }) =>
      `${row.original.status.readyReplicas}/${row.original.spec?.replicas ?? 0}`,
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
  resource: DeploymentResource;
  subContent?: unknown;
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  const sub = subContent as
    { pods: string[]; events: { message: string; time: string }[] } | undefined;
  const pods = sub?.pods ?? [];

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            {
              label: "Image",
              value: resource.spec?.image,
              mono: true,
              copy: resource.spec?.image,
            },
            { label: "Strategy", value: resource.spec?.strategy },
            {
              label: "Replicas",
              value: `${resource.status.readyReplicas}/${resource.spec?.replicas ?? 0} ready`,
            },
            { label: "Available", value: resource.status.availableReplicas },
          ]}
        />
      </DetailSection>
      <RelatedPanel
        groups={[
          {
            kind: "Pod",
            relation: "Owned by this Deployment",
            items: pods.map((name) => ({
              name,
              namespace: resource.metadata.namespace,
            })),
            emptyMessage: "No owned pods",
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

export const deploymentResourceType: ResourceTypeDefinition<DeploymentResource> =
  {
    kind: "Deployment",
    label: "Deployment",
    icon: Layers,
    columns,
    pollingIntervalMs: 10_000,
    subContentLabel: "Related resources",
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<DeploymentResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<DeploymentResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    fetchSubContent: (namespace, name) =>
      apiFetch<unknown>(
        endpoints.subContent(KIND_PATH, namespace, name, "related"),
      ),
    DetailRenderer,
  };
