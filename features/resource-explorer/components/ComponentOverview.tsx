"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { K8sResource, ResourceStatusLevel } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/utils/format";
import { STATUS_ORDER } from "@/features/resource-explorer/lib/list-state";
import { PageHeader } from "./PageHeader";
import { SectionHeader } from "./SectionHeader";
import { AutoUpdateIndicator } from "./AutoUpdateIndicator";
import { SegmentedControl } from "./SegmentedControl";
import { StatusBar, statusCounts } from "./Meters";
import { StatusDot, statusTone } from "./StatusBadge";

/** States that need someone to act; Progressing usually resolves by itself. */
const ACTIONABLE: ResourceStatusLevel[] = ["Error", "Warning", "Unknown"];
const VISIBLE_ISSUES = 8;
const COMPACT_AFTER = 8;

export interface OverviewTile {
  id: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  statuses?: ResourceStatusLevel[];
  href?: string;
  statusHref?: (level: ResourceStatusLevel) => string;
  unavailable?: string;
  loading?: boolean;
  error?: boolean;
}

export interface AttentionItem {
  resource: K8sResource;
  kindLabel: string;
  detailHref: string;
}

export function ComponentOverview({
  title,
  description,
  tiles,
  items,
  failed,
  loading,
  isFetching,
  dataUpdatedAt,
  onRefresh,
  listUrl,
  insights,
}: {
  title: string;
  description: string;
  tiles: OverviewTile[];
  /** Every loaded resource; the overview selects the ones that need attention. */
  items: AttentionItem[];
  /** Labels of kinds that failed to load. */
  failed: string[];
  loading: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  onRefresh: () => void;
  listUrl: (kind: string, status?: ResourceStatusLevel) => string | undefined;
  insights?: ReactNode;
}) {
  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <AutoUpdateIndicator
            isFetching={isFetching}
            dataUpdatedAt={dataUpdatedAt}
            onRefresh={onRefresh}
          />
        }
      />
      <HealthHeadline items={items} failed={failed} loading={loading} />
      <TileGrid tiles={tiles} />
      <AttentionList
        items={items}
        failed={failed}
        loading={loading}
        listUrl={listUrl}
      />
      {insights}
    </div>
  );
}

function HealthHeadline({
  items,
  failed,
  loading,
}: {
  items: AttentionItem[];
  failed: string[];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-6 w-96 max-w-full" />;
  const counts = statusCounts(
    items.map(({ resource }) => resource.status.level),
  );
  const attention = ACTIONABLE.reduce(
    (sum, level) => sum + (counts[level] ?? 0),
    0,
  );
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {attention > 0 ? (
          <span className="font-medium">
            {attention} of {items.length} resources need attention
          </span>
        ) : failed.length ? (
          <span className="font-medium">
            No issues found in the resources that loaded
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 aria-hidden className="text-status-healthy size-4" />
            All {items.length} resources are healthy
          </span>
        )}
        {ACTIONABLE.filter((level) => counts[level]).map((level) => (
          <span
            key={level}
            className={cn(
              "inline-flex items-center gap-1.5",
              statusTone(level).text,
            )}
          >
            <StatusDot level={level} />
            {counts[level]} {level}
          </span>
        ))}
        {counts.Progressing ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <StatusDot level="Progressing" />
            {counts.Progressing} rolling out
          </span>
        ) : null}
      </p>
      {failed.length > 0 && (
        <p
          role="alert"
          className="text-destructive flex items-center gap-1.5 text-sm"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          Health unknown for {failed.join(", ")}.
        </p>
      )}
    </div>
  );
}

function TileGrid({ tiles }: { tiles: OverviewTile[] }) {
  const compact = tiles.length > COMPACT_AFTER;
  const groups: { group?: string; tiles: OverviewTile[] }[] = [];
  for (const tile of tiles) {
    const last = groups.at(-1);
    if (last && last.group === tile.group) last.tiles.push(tile);
    else groups.push({ group: tile.group, tiles: [tile] });
  }
  return (
    <div className="space-y-5">
      {groups.map(({ group, tiles }, index) => (
        <section key={group ?? index} aria-label={group} className="space-y-2">
          {group && (
            <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {group}
            </h3>
          )}
          <ul
            className={cn(
              "grid gap-3",
              compact
                ? "sm:grid-cols-2 xl:grid-cols-4"
                : "sm:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {tiles.map((tile) => (
              <li key={tile.id}>
                <Tile tile={tile} compact={compact} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Tile({ tile, compact }: { tile: OverviewTile; compact: boolean }) {
  const Icon = tile.icon;
  const statuses = tile.statuses ?? [];
  const counts = statusCounts(statuses);
  const issues = ACTIONABLE.filter((level) => counts[level]);
  const disabled = !!tile.unavailable;
  const name =
    tile.href && !disabled ? (
      <Link
        href={tile.href}
        className="focus-visible:ring-ring/50 truncate rounded-sm text-sm font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        {tile.label}
      </Link>
    ) : (
      <span className="truncate text-sm font-medium">{tile.label}</span>
    );
  const breakdown = tile.loading ? (
    <Skeleton className="h-3.5 w-24" />
  ) : tile.error ? (
    <span className="text-destructive">Unable to load</span>
  ) : disabled ? (
    <span>{tile.unavailable}</span>
  ) : issues.length === 0 ? (
    <span>{statuses.length ? "All healthy" : "None"}</span>
  ) : (
    <span className="flex flex-wrap gap-x-2">
      {issues.map((level) => {
        const text = `${counts[level]} ${level}`;
        const className = cn(
          "relative z-10 font-medium",
          statusTone(level).text,
        );
        return tile.statusHref ? (
          <Link
            key={level}
            href={tile.statusHref(level)}
            className={cn(
              className,
              "focus-visible:ring-ring/50 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            {text}
          </Link>
        ) : (
          <span key={level} className={className}>
            {text}
          </span>
        );
      })}
    </span>
  );
  const count = tile.loading ? (
    <Skeleton className={compact ? "h-5 w-6" : "h-8 w-12"} />
  ) : (
    <span
      className={cn(
        "font-semibold tabular-nums",
        compact ? "text-base" : "text-2xl",
      )}
    >
      {disabled || tile.error ? "—" : statuses.length}
    </span>
  );
  return (
    <div
      className={cn(
        "relative rounded-lg border transition-colors",
        compact ? "space-y-2 px-3 py-2.5" : "space-y-3 p-4",
        disabled
          ? "bg-muted/30 text-muted-foreground"
          : tile.href && "hover:bg-accent/60",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
        {name}
        {compact && <span className="ml-auto">{count}</span>}
      </div>
      {!compact && count}
      <StatusBar counts={counts} total={statuses.length} />
      <div className="text-muted-foreground text-xs">{breakdown}</div>
    </div>
  );
}

function AttentionList({
  items,
  failed,
  loading,
  listUrl,
}: {
  items: AttentionItem[];
  failed: string[];
  loading: boolean;
  listUrl: (kind: string, status?: ResourceStatusLevel) => string | undefined;
}) {
  const [filter, setFilter] = useState<"all" | ResourceStatusLevel>("all");
  const issues = items
    .filter(({ resource }) => ACTIONABLE.includes(resource.status.level))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.resource.status.level] -
          STATUS_ORDER[b.resource.status.level] ||
        a.resource.metadata.name.localeCompare(b.resource.metadata.name),
    );
  const counts = statusCounts(
    issues.map(({ resource }) => resource.status.level),
  );
  const filtered =
    filter === "all"
      ? issues
      : issues.filter(({ resource }) => resource.status.level === filter);
  const visible = filtered.slice(0, VISIBLE_ISSUES);
  const byKind = new Map<
    string,
    { label: string; count: number; levels: Set<ResourceStatusLevel> }
  >();
  for (const { resource, kindLabel } of filtered) {
    const entry = byKind.get(resource.kind) ?? {
      label: kindLabel,
      count: 0,
      levels: new Set(),
    };
    entry.count += 1;
    entry.levels.add(resource.status.level);
    byKind.set(resource.kind, entry);
  }
  return (
    <section aria-label="Top issues" className="space-y-3">
      <SectionHeader
        title="Top issues"
        count={loading ? undefined : issues.length}
        countLoading={loading}
        action={
          issues.length > 0 && (
            <SegmentedControl
              label="Filter issues"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: issues.length },
                ...ACTIONABLE.filter((level) => counts[level]).map((level) => ({
                  value: level,
                  label: level,
                  count: counts[level],
                  tone: level,
                })),
              ]}
            />
          )
        }
      />
      {loading ? (
        <div role="status" className="divide-y rounded-lg border">
          <span className="sr-only">Loading issues</span>
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex gap-4 px-3 py-3">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CheckCircle2 aria-hidden className="text-status-healthy size-4" />
          {failed.length
            ? "No issues in the resources that loaded."
            : "No issues reported."}
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {visible.map(({ resource, kindLabel, detailHref }, index) => (
              <li
                key={resource.metadata.uid}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 md:grid-cols-[auto_minmax(0,16rem)_minmax(0,11rem)_minmax(0,1fr)_auto]",
                  index >= 5 && "max-md:hidden",
                )}
              >
                <StatusDot level={resource.status.level} />
                <Link
                  href={detailHref}
                  title={resource.metadata.name}
                  aria-label={`View ${kindLabel} ${resource.metadata.name}${resource.metadata.namespace ? ` in ${resource.metadata.namespace}` : ""}`}
                  className="hover:text-primary focus-visible:ring-ring/50 truncate rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {resource.metadata.name}
                </Link>
                <span className="text-muted-foreground row-start-2 truncate text-xs md:row-start-auto">
                  {kindLabel}
                  {resource.metadata.namespace
                    ? ` · ${resource.metadata.namespace}`
                    : ""}
                </span>
                <span
                  title={resource.status.message}
                  className="text-muted-foreground col-span-2 col-start-2 row-start-3 truncate text-xs md:col-span-1 md:col-start-auto md:row-start-auto md:text-sm"
                >
                  {resource.status.message ?? "—"}
                </span>
                <span className="text-muted-foreground row-start-1 text-right text-xs md:row-start-auto">
                  {formatAge(resource.metadata.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="tabular-nums">
              Showing {visible.length} of {filtered.length}
            </span>
            {[...byKind].map(([kind, { label, count, levels }]) => {
              // A list can filter by one status, so link it when the issues share one.
              const href = listUrl(
                kind,
                levels.size === 1 ? [...levels][0] : undefined,
              );
              return href ? (
                <Link
                  key={kind}
                  href={href}
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  {label} {count} →
                </Link>
              ) : (
                <span key={kind}>
                  {label} {count}
                </span>
              );
            })}
          </p>
        </>
      )}
    </section>
  );
}
