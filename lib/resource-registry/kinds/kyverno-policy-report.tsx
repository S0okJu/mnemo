import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  K8sResource,
  ResourceList,
  ResourceListFilters,
} from "@/lib/api/types";
import type { ResourceTypeDefinition } from "@/lib/resource-registry/types";
import { StatusBadge } from "@/features/resource-explorer/components/StatusBadge";
import { ResourceLink } from "@/features/resource-explorer/components/ResourceLink";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  policyResultLevel,
  sortPolicyResults,
  type KyvernoPolicyReportResultEntry,
} from "@/features/resource-explorer/lib/policy-report-results";
import { resolveResourceReference } from "@/lib/resource-registry/resource-reference";
import { TagList } from "@/features/resource-explorer/components/TagList";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";
import { formatAge } from "@/lib/utils/format";

export interface KyvernoPolicyReportSpec {
  scope: string;
  results: KyvernoPolicyReportResultEntry[];
}

export interface KyvernoPolicyReportStatusExtra {
  pass: number;
  fail: number;
  warn: number;
  error: number;
  skip: number;
}

export type KyvernoPolicyReportResource = K8sResource<
  KyvernoPolicyReportSpec,
  KyvernoPolicyReportStatusExtra
>;

const KIND_PATH = "kyverno/policy-reports";

const resultHeaders = ["Result", "Policy", "Rule", "Resource", "Severity"];

const columns: ColumnDef<KyvernoPolicyReportResource>[] = [
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
    id: "pass",
    header: "Pass",
    cell: ({ row }) => row.original.status.pass,
  },
  {
    id: "fail",
    header: "Fail",
    cell: ({ row }) => row.original.status.fail,
  },
  {
    id: "warn",
    header: "Warn",
    cell: ({ row }) => row.original.status.warn,
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

function PolicyResultTable({
  results,
  namespace,
}: {
  results: KyvernoPolicyReportResultEntry[];
  namespace?: string;
}) {
  if (results.length === 0)
    return <p className="text-muted-foreground text-sm">No results</p>;
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {resultHeaders.map((title) => (
              <TableHead
                key={title}
                className="text-muted-foreground h-9 px-3 text-xs"
              >
                {title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((entry, i) => (
            <TableRow
              key={`${entry.policy}/${entry.rule}/${entry.resource}/${i}`}
            >
              <TableCell className="px-3 py-2">
                <StatusBadge
                  level={policyResultLevel(entry.result)}
                  label={entry.result}
                />
              </TableCell>
              <TableCell className="px-3 py-2 font-mono text-xs whitespace-normal">
                {entry.policy}
              </TableCell>
              <TableCell className="px-3 py-2 font-mono text-xs whitespace-normal">
                {entry.rule}
              </TableCell>
              <TableCell className="px-3 py-2 text-sm whitespace-normal">
                {entry.resource ? (
                  <span className="inline-flex flex-wrap items-baseline gap-1.5">
                    <span className="text-muted-foreground text-xs">
                      {resolveResourceReference({ name: entry.resource }).label}
                    </span>
                    <ResourceLink name={entry.resource} namespace={namespace} />
                  </span>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="px-3 py-2 text-sm">
                {entry.severity ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailRenderer({
  resource,
}: {
  resource: KyvernoPolicyReportResource;
}) {
  // Older projections predate spec.results.
  const results = sortPolicyResults(resource.spec?.results ?? []);

  return (
    <div className="space-y-8">
      <DetailSection title="Summary">
        <PropertyList
          items={[
            {
              label: "Pass",
              value: (
                <span className="text-status-healthy text-lg font-semibold tabular-nums">
                  {resource.status.pass}
                </span>
              ),
            },
            {
              label: "Fail",
              value: (
                <span className="text-status-error text-lg font-semibold tabular-nums">
                  {resource.status.fail}
                </span>
              ),
            },
            {
              label: "Warn",
              value: (
                <span className="text-status-warning text-lg font-semibold tabular-nums">
                  {resource.status.warn}
                </span>
              ),
            },
            {
              label: "Error",
              value: (
                <span className="text-status-error text-lg font-semibold tabular-nums">
                  {resource.status.error ?? 0}
                </span>
              ),
            },
            {
              label: "Skip",
              value: (
                <span className="text-muted-foreground text-lg font-semibold tabular-nums">
                  {resource.status.skip ?? 0}
                </span>
              ),
            },
          ]}
        />
      </DetailSection>
      <DetailSection title="Results" count={results.length}>
        <PolicyResultTable
          results={results}
          namespace={resource.metadata.namespace}
        />
      </DetailSection>
      <DetailSection title="Labels">
        <TagList labels={resource.metadata.labels} />
      </DetailSection>
    </div>
  );
}

export const kyvernoPolicyReportResourceType: ResourceTypeDefinition<KyvernoPolicyReportResource> =
  {
    kind: "KyvernoPolicyReport",
    label: "PolicyReport",
    icon: ShieldAlert,
    columns,
    pollingIntervalMs: 15_000,
    fetchList: (filters: ResourceListFilters) =>
      apiFetch<ResourceList<KyvernoPolicyReportResource>>(
        `${endpoints.list(KIND_PATH)}${toQueryString(filters)}`,
      ),
    fetchDetail: (namespace, name) =>
      apiFetch<KyvernoPolicyReportResource>(
        endpoints.detail(KIND_PATH, namespace, name),
      ),
    DetailRenderer,
  };
