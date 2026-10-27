"use client";

import { useQueries } from "@tanstack/react-query";
import {
  kubeOvnAvailability,
  kubeOvnPlugin,
  kubeOvnLabel,
  kubeOvnResourceHref,
} from "@/features/plugins/registry/kube-ovn";
import { usePluginCapabilities } from "@/features/plugins/hooks/usePluginCapabilities";
import { getResourceType } from "@/lib/resource-registry/registry";
import type { KubeOvnResource } from "@/lib/resource-registry/kinds/kube-ovn";
import { resourceKeys } from "@/lib/query/queryKeys";
import type { ResourceStatusLevel } from "@/lib/api/types";
import { resourceDetailHref } from "@/features/resource-explorer/lib/list-state";
import {
  AutoRefreshProvider,
  useAutoRefresh,
} from "@/features/resource-explorer/components/AutoUpdateIndicator";
import {
  ComponentOverview,
  type AttentionItem,
  type OverviewTile,
} from "@/features/resource-explorer/components/ComponentOverview";
import { CapacityMeter } from "@/features/resource-explorer/components/Meters";
import { ResourceLink } from "@/features/resource-explorer/components/ResourceLink";
import { SectionHeader } from "@/features/resource-explorer/components/SectionHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RETURN_TO = kubeOvnPlugin.basePath;
const KINDS = kubeOvnPlugin.sections.flatMap((section) => section.kinds);

export function KubeOvnOverview() {
  return (
    <AutoRefreshProvider>
      <Overview />
    </AutoRefreshProvider>
  );
}

function Overview() {
  const capabilities = usePluginCapabilities(kubeOvnPlugin.id);
  const paused = useAutoRefresh()?.paused ?? false;
  const unavailable = (kind: string) =>
    kubeOvnAvailability(kind, capabilities.data?.resources ?? []);
  const queries = useQueries({
    queries: KINDS.map((kind) => ({
      queryKey: resourceKeys.list(kind, {}),
      queryFn: () => getResourceType(kind).fetchList({}),
      enabled: !unavailable(kind),
      refetchInterval: paused ? (false as const) : 10000,
      retry: false,
    })),
  });
  const listUrl = (kind: string, status?: ResourceStatusLevel) => {
    const href = kubeOvnResourceHref(kind);
    return href && status ? `${href}?status=${status}` : href;
  };
  const tiles: OverviewTile[] = KINDS.map((kind, index) => ({
    id: kind,
    label: kubeOvnLabel(kind),
    icon: getResourceType(kind).icon,
    group: kubeOvnPlugin.sections.find((section) =>
      section.kinds.includes(kind),
    )?.label,
    statuses: queries[index].data?.items.map((item) => item.status.level),
    href: listUrl(kind),
    statusHref: (level: ResourceStatusLevel) => listUrl(kind, level)!,
    unavailable: unavailable(kind),
    loading: !unavailable(kind) && queries[index].isLoading,
    error: queries[index].isError,
  }));
  const items: AttentionItem[] = queries.flatMap((query, index) =>
    (query.data?.items ?? []).map((resource) => ({
      resource,
      kindLabel: getResourceType(KINDS[index]).label,
      detailHref: resourceDetailHref(
        kubeOvnResourceHref(KINDS[index])!,
        resource,
        RETURN_TO,
      ),
    })),
  );
  const subnetIndex = KINDS.indexOf("KubeOvnSubnet");
  const subnets = (queries[subnetIndex].data?.items ?? []) as KubeOvnResource[];
  const tracked = queries.filter((_, index) => !unavailable(KINDS[index]));
  return (
    <ComponentOverview
      title="Kube-OVN overview"
      description="Network health and address capacity."
      tiles={tiles}
      items={items}
      failed={KINDS.filter((kind, index) => queries[index].isError).map(
        kubeOvnLabel,
      )}
      loading={
        capabilities.isPending || tracked.some((query) => query.isLoading)
      }
      isFetching={tracked.some((query) => query.isFetching)}
      dataUpdatedAt={Math.max(
        0,
        ...tracked.map((query) => query.dataUpdatedAt),
      )}
      onRefresh={() => tracked.forEach((query) => void query.refetch())}
      listUrl={listUrl}
      insights={
        !unavailable("KubeOvnSubnet") &&
        !queries[subnetIndex].isError && (
          <SubnetCapacity
            subnets={subnets}
            loading={queries[subnetIndex].isLoading}
          />
        )
      }
    />
  );
}

const CAPACITY_ROWS = 5;

function SubnetCapacity({
  subnets,
  loading,
}: {
  subnets: KubeOvnResource[];
  loading: boolean;
}) {
  const rows = subnets
    .map((subnet) => {
      const used = Number(subnet.status.v4usingIPs);
      const available = Number(subnet.status.v4availableIPs);
      const known =
        Number.isFinite(used) &&
        Number.isFinite(available) &&
        used >= 0 &&
        available >= 0;
      const total = used + available;
      return {
        subnet,
        used,
        total,
        known,
        percent: known && total > 0 ? used / total : -1,
      };
    })
    .sort((a, b) => b.percent - a.percent);
  return (
    <section aria-label="Subnet IPv4 capacity" className="space-y-3">
      <SectionHeader
        title="Subnet IPv4 capacity"
        count={loading ? undefined : subnets.length}
        countLoading={loading}
        link={
          subnets.length > CAPACITY_ROWS
            ? {
                href: kubeOvnResourceHref("KubeOvnSubnet")!,
                label: "View all subnets",
              }
            : undefined
        }
      />
      {!loading && subnets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No subnets found</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground h-9 px-3 text-xs">
                  Subnet
                </TableHead>
                <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs">
                  Used / Total
                </TableHead>
                <TableHead className="text-muted-foreground h-9 w-1/3 px-3 text-xs">
                  Utilization
                </TableHead>
                <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs">
                  %
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .slice(0, CAPACITY_ROWS)
                .map(({ subnet, used, total, known }) => (
                  <TableRow key={subnet.metadata.uid}>
                    <TableCell className="px-3 py-2">
                      <ResourceLink
                        kind="KubeOvnSubnet"
                        name={subnet.metadata.name}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">
                      {known ? `${used} / ${total}` : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {known ? (
                        <CapacityMeter
                          used={used}
                          total={total}
                          label={`${subnet.metadata.name} IPv4 utilization`}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not reported
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">
                      {known && total > 0
                        ? `${Math.round((used / total) * 100)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
