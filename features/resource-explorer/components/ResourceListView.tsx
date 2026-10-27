"use client";
import Link from "next/link";
import { useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, RotateCcw, Rows3, Rows4, Search, X } from "lucide-react";
import type { K8sResource, ResourceStatusLevel } from "@/lib/api/types";
import { getResourceType } from "@/lib/resource-registry/registry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResourceTable, type TableDensity } from "./ResourceTable";
import { StatusBadge, StatusDot, statusTone } from "./StatusBadge";
import { PageHeader } from "./PageHeader";
import { StatusBar, STATUS_DISPLAY_ORDER } from "./Meters";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { AutoUpdateIndicator } from "./AutoUpdateIndicator";
import { ResourcePagination } from "./ResourcePagination";
import { QueryError } from "./QueryError";
import { ResourceLink } from "./ResourceLink";
import { useUrlState } from "@/features/resource-explorer/hooks/useUrlState";
import {
  filterAndSortRows,
  readListState,
  resourceDetailHref,
  STATUS_ORDER,
} from "@/features/resource-explorer/lib/list-state";
import type {
  ResourceQueryResult,
  SubsystemKind,
} from "@/features/resource-explorer/types";
import { formatAge } from "@/lib/utils/format";

const columns: ColumnDef<K8sResource>[] = [
  {
    accessorKey: "metadata.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.metadata.name}</span>
    ),
  },
  {
    id: "kind",
    header: "Kind",
    cell: ({ row }) => getResourceType(row.original.kind).label,
  },
  {
    id: "namespace",
    header: "Namespace",
    cell: ({ row }) =>
      row.original.metadata.namespace ? (
        <ResourceLink kind="Namespace" name={row.original.metadata.namespace} />
      ) : (
        <span className="text-muted-foreground">Cluster scoped</span>
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
const selectClass =
  "border-input bg-background text-foreground focus-visible:ring-ring/50 h-9 max-w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const STATUS_LEVELS = Object.keys(STATUS_ORDER) as ResourceStatusLevel[];
const DISPLAY_ORDER = STATUS_DISPLAY_ORDER;
export function ResourceListView({
  kinds,
  results,
}: {
  kinds: SubsystemKind[];
  results: ResourceQueryResult[];
}) {
  const { searchParams, update, href } = useUrlState();
  const [density, setDensity] = useLocalStorageState<TableDensity>(
    "mnemo.table.density",
    "comfortable",
  );
  const parsedState = readListState(
    new URLSearchParams(searchParams.toString()),
    kinds.map((kind) => kind.kind),
  );
  const state = {
    ...parsedState,
    type: parsedState.type === "all" ? kinds[0].kind : parsedState.type,
  };
  const selectedKinds =
    state.type === "all"
      ? kinds
      : kinds.filter((kind) => kind.kind === state.type);
  const selectedResults = results.filter((_, index) =>
    selectedKinds.some((kind) => kind.kind === kinds[index].kind),
  );
  const sourceRows = results.flatMap((result, index) =>
    (result.data?.items ?? []).map((item) => ({
      item,
      listHref: kinds[index].listHref,
    })),
  );
  const filtered = filterAndSortRows(sourceRows, state);
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const page = Math.min(state.page, pageCount);
  const isLoading = selectedResults.some((result) => result.isLoading);
  const failed = selectedResults.find((result) => result.isError);
  const namespaceOptions = [
    ...new Set(
      sourceRows
        .map(({ item }) => item.metadata.namespace)
        .filter((namespace): namespace is string => !!namespace),
    ),
  ].sort();
  if (
    state.namespace !== "all" &&
    state.namespace !== "_" &&
    !namespaceOptions.includes(state.namespace)
  )
    namespaceOptions.push(state.namespace);
  function change(
    changes: Record<string, string | undefined>,
    mode: "push" | "replace" = "push",
  ) {
    update(
      {
        view: "resources",
        type: state.type === "all" ? undefined : state.type,
        tab: undefined,
        page: undefined,
        ...changes,
      },
      mode,
    );
  }
  // Polling may remove the final page; replace the URL without creating a new history entry.
  useEffect(() => {
    if (!isLoading && !failed && state.page > pageCount)
      update(
        { page: pageCount > 1 ? String(pageCount) : undefined },
        "replace",
      );
  }, [isLoading, failed, state.page, pageCount, update]);
  const selectedType =
    kinds.length === 1
      ? kinds[0].kind
      : state.type !== "all"
        ? state.type
        : undefined;
  const activeColumns: ColumnDef<K8sResource>[] = selectedType
    ? (getResourceType(selectedType).columns as ColumnDef<K8sResource>[])
    : columns;
  const paginated = filtered
    .slice((page - 1) * state.pageSize, page * state.pageSize)
    .map(({ item }) => item);
  const detailHref = (item: K8sResource) =>
    resourceDetailHref(
      kinds.find((kind) => kind.kind === item.kind)!.listHref,
      item,
      href,
    );
  const filteredByUser =
    state.search || state.namespace !== "all" || state.status !== "all";
  const typeRows = sourceRows.filter(({ item }) => item.kind === state.type);
  const typeDefinition = getResourceType(state.type);
  const typeLabel = typeDefinition.label;
  const indicator = (
    <AutoUpdateIndicator
      isFetching={selectedResults.some((result) => result.isFetching)}
      dataUpdatedAt={Math.max(
        0,
        ...selectedResults.map((result) => result.dataUpdatedAt),
      )}
      onRefresh={() => selectedResults.forEach((result) => result.refetch())}
    />
  );
  const chips = [
    state.search && {
      key: "q",
      label: `Name contains “${state.search}”`,
    },
    state.namespace !== "all" && {
      key: "namespace",
      label: `Namespace: ${state.namespace === "_" ? "Cluster scoped" : state.namespace}`,
    },
    state.status !== "all" && {
      key: "status",
      label: `Status: ${state.status}`,
    },
  ].filter((chip): chip is { key: string; label: string } => !!chip);
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title={typeLabel}
        description={`Health and status of ${typeLabel} resources in this cluster.`}
        actions={indicator}
      />
      <StatusSummary
        rows={typeRows.map(({ item }) => item.status.level)}
        selected={state.status}
        loading={isLoading}
        failed={!!failed}
        onSelect={(status) =>
          change({ status: status === "all" ? undefined : status })
        }
      />
      <div className="space-y-2">
        <div
          role="search"
          aria-label="Filter resources"
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden
              className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            />
            <Input
              value={state.search}
              onChange={(event) => change({ q: event.target.value }, "replace")}
              aria-label="Search resources by name"
              placeholder="Search by name…"
              className="h-9 pl-8"
            />
          </div>
          <select
            aria-label="Namespace"
            className={selectClass}
            value={state.namespace}
            onChange={(event) =>
              change({
                namespace:
                  event.target.value === "all" ? undefined : event.target.value,
              })
            }
          >
            <option value="all">All namespaces</option>
            <option value="_">Cluster scoped</option>
            {namespaceOptions.map((namespace) => (
              <option key={namespace} value={namespace}>
                {namespace}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            className={selectClass}
            value={state.status}
            onChange={(event) =>
              change({
                status:
                  event.target.value === "all" ? undefined : event.target.value,
              })
            }
          >
            <option value="all">All statuses</option>
            {DISPLAY_ORDER.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Compact rows"
                  aria-pressed={density === "compact"}
                  onClick={() =>
                    setDensity(
                      density === "compact" ? "comfortable" : "compact",
                    )
                  }
                  className={cn(density === "compact" && "bg-muted")}
                />
              }
            >
              {density === "compact" ? (
                <Rows4 aria-hidden />
              ) : (
                <Rows3 aria-hidden />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {density === "compact" ? "Comfortable rows" : "Compact rows"}
            </TooltipContent>
          </Tooltip>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1 tabular-nums">
              {isLoading
                ? "Filtering…"
                : `Showing ${filtered.length} of ${typeRows.length}`}
            </span>
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="bg-count-subtle text-count inline-flex h-6 items-center gap-1 rounded-md pr-0.5 pl-2 font-medium"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => change({ [chip.key]: undefined })}
                  className="hover:bg-count/15 focus-visible:ring-ring/50 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            ))}
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() =>
                change({
                  q: undefined,
                  namespace: undefined,
                  status: undefined,
                })
              }
            >
              <RotateCcw aria-hidden />
              Reset filters
            </Button>
          </div>
        )}
      </div>
      {failed && (
        <QueryError
          error={failed.error}
          onRetry={() => selectedResults.forEach((result) => result.refetch())}
        />
      )}
      {(!failed || paginated.length > 0) && (
        <div
          className={
            !isLoading && paginated.length > 0 ? "hidden md:block" : undefined
          }
        >
          <ResourceTable
            columns={activeColumns}
            data={paginated}
            isLoading={isLoading}
            emptyLabel={
              filteredByUser
                ? "No resources match these filters. Adjust or reset the filters to try again."
                : "No resources are available in this section."
            }
            getDetailHref={detailHref}
            sort={state.sort}
            direction={state.direction}
            onSortChange={(sort, dir) =>
              change({
                sort: sort === "severity" && dir === "asc" ? undefined : sort,
                dir: dir === "desc" ? dir : undefined,
              })
            }
            density={density}
          />
        </div>
      )}
      {!isLoading && paginated.length > 0 && (
        <ul
          aria-label="Resource results"
          className="divide-y rounded-lg border md:hidden"
        >
          {paginated.map((item) => (
            <li key={item.metadata.uid}>
              <Link
                href={detailHref(item)}
                className="hover:bg-accent/60 focus-visible:ring-ring/50 block space-y-1 px-3 py-2.5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {item.metadata.name}
                  </span>
                  <StatusBadge level={item.status.level} variant="dot" />
                </div>
                <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
                  <span className="truncate">
                    {item.metadata.namespace ?? "Cluster scoped"}
                  </span>
                  <span>{formatAge(item.metadata.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && filtered.length > 0 && (
        <ResourcePagination
          total={filtered.length}
          page={page}
          pageSize={state.pageSize}
          onPageChange={(next) =>
            update({ page: next > 1 ? String(next) : undefined })
          }
          onPageSizeChange={(size) => change({ pageSize: String(size) })}
        />
      )}
      {failed && paginated.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Showing accessible data. Counts may be incomplete.
        </p>
      )}
    </div>
  );
}

/** Segmented status filter with a proportional health bar. */
function StatusSummary({
  rows,
  selected,
  loading,
  failed,
  onSelect,
}: {
  rows: ResourceStatusLevel[];
  selected: string;
  loading: boolean;
  failed: boolean;
  onSelect: (status: string) => void;
}) {
  const counts = Object.fromEntries(
    STATUS_LEVELS.map((level) => [
      level,
      rows.filter((status) => status === level).length,
    ]),
  ) as Record<ResourceStatusLevel, number>;
  const known = !loading && !failed;
  const segments: { value: string; label: string; count: number }[] = [
    { value: "all", label: "Total", count: rows.length },
    ...DISPLAY_ORDER.map((level) => ({
      value: level,
      label: level,
      count: counts[level],
    })),
  ];
  return (
    <div className="space-y-2">
      <div
        aria-label="Resource summary"
        role="group"
        className="flex flex-wrap gap-1.5"
      >
        {segments.map(({ value, label, count }) => {
          const active = selected === value;
          const level =
            value === "all" ? undefined : (value as ResourceStatusLevel);
          return (
            <button
              key={value}
              type="button"
              onClick={() =>
                onSelect(active && value !== "all" ? "all" : value)
              }
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-foreground/70 bg-accent ring-foreground/10 ring-1"
                  : "hover:bg-accent/60 border-border",
                known && count === 0 && !active && "text-muted-foreground",
              )}
            >
              {level ? (
                <StatusDot
                  level={level}
                  className={cn(known && count === 0 && "opacity-40")}
                />
              ) : null}
              <span>{label}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  level &&
                    count > 0 &&
                    level !== "Healthy" &&
                    statusTone(level).text,
                )}
              >
                {loading ? "…" : failed ? "—" : count}
              </span>
              {active && <Check aria-hidden className="size-3.5" />}
            </button>
          );
        })}
      </div>
      {known && rows.length > 0 && (
        <StatusBar counts={counts} total={rows.length} />
      )}
    </div>
  );
}
