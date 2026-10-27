"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ChevronDown,
  Info,
  Link2,
  Search,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type {
  K8sResource,
  ResourceList,
  ResourceStatusLevel,
} from "@/lib/api/types";
import { resourceApiPaths } from "@/lib/resource-registry/resource-paths";
import { resourceKeys } from "@/lib/query/queryKeys";
import {
  resolveResourceReference,
  type ResourceReference,
} from "@/lib/resource-registry/resource-reference";
import { STATUS_ORDER } from "@/features/resource-explorer/lib/list-state";
import {
  relatedColumns,
  relatedKindIcon,
  relatedKindRank,
  relatedResourceKind,
  type RelatedColumn,
} from "../lib/related-resource-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatAge, pluralize } from "@/lib/utils/format";
import { StatusBadge, StatusDot, statusTone } from "./StatusBadge";
import { SectionHeader } from "./SectionHeader";
import { CountBadge } from "./CountBadge";
import { useResourceNavigation } from "./ResourceNavigation";
import { RelatedKindSummary } from "./RelatedKindSummary";

export const RelatedErrorContext = createContext<Error | null>(null);
/** Namespace of the page showing the panel; a column repeating it is hidden. */
export const RelatedNamespaceContext = createContext<string | undefined>(
  undefined,
);

export interface RelatedPanelItem extends ResourceReference {
  /** Caller-provided value shown in the group's detail column. */
  detail?: ReactNode;
  /** Known status, used when the related list query is not needed. */
  status?: ResourceStatusLevel;
}

export interface RelatedGroup {
  kind: string;
  /** How the group relates to the current resource, e.g. "Owned by this Deployment". */
  relation?: string;
  items: RelatedPanelItem[];
  isLoading?: boolean;
  errorMessage?: string;
  onRetry?: () => unknown;
  emptyMessage?: string;
  detailLabel?: string;
  /** "summary" renders a containment relation as counts plus issue rows. */
  presentation?: "rows" | "summary";
  /** Filtered list showing every member, for summary presentation. */
  listHref?: string;
}

/** Group state for relations that come from a detail page's sub-content request. */
export function relatedSubState({
  isLoadingSub,
  isErrorSub,
  refetchSub,
}: {
  isLoadingSub: boolean;
  isErrorSub?: boolean;
  refetchSub?: () => unknown;
}) {
  return {
    isLoading: isLoadingSub,
    errorMessage: isErrorSub ? "Unable to load related data" : undefined,
    onRetry: refetchSub,
  };
}

/** Split references of mixed kinds into groups that share the given fields. */
export function groupByKind(
  items: RelatedPanelItem[],
  base: Omit<Partial<RelatedGroup>, "kind" | "items"> = {},
): RelatedGroup[] {
  const groups = new Map<string, RelatedPanelItem[]>();
  for (const item of items) {
    const kind = resolveResourceReference(item).kind;
    groups.set(kind, [...(groups.get(kind) ?? []), item]);
  }
  return [...groups]
    .sort(([a], [b]) => relatedKindRank(a) - relatedKindRank(b))
    .map(([kind, groupItems]) => ({ ...base, kind, items: groupItems }));
}

const PREVIEW_ROWS = 5;
const PAGE_ROWS = 25;
const SMALL_GROUP = 2;
const DENIED_MESSAGE =
  "Insufficient permissions to view related resources. Request access from your cluster administrator.";
const ISSUES: ResourceStatusLevel[] = [
  "Error",
  "Warning",
  "Progressing",
  "Unknown",
];

type InfoQuery = UseQueryResult<ResourceList<K8sResource>>;

export interface ResolvedRow {
  item: RelatedPanelItem;
  reference: ReturnType<typeof resolveResourceReference>;
  resource?: K8sResource;
  status?: ResourceStatusLevel;
}

interface ResolvedGroup extends RelatedGroup {
  key: string;
  label: string;
  rows: ResolvedRow[];
  info?: InfoQuery;
  /** Several small groups shown together with a Kind column. */
  merged?: boolean;
}

function referenceKey(reference: ResourceReference) {
  const resolved = resolveResourceReference(reference);
  return `${relatedResourceKind(resolved.kind)}/${resolved.namespace ?? ""}/${resolved.name}`;
}

function isIssue(row: ResolvedRow) {
  return row.status !== undefined && row.status !== "Healthy";
}

function bySeverity(a: ResolvedRow, b: ResolvedRow) {
  return (
    (a.status ? STATUS_ORDER[a.status] : 5) -
      (b.status ? STATUS_ORDER[b.status] : 5) ||
    a.reference.name.localeCompare(b.reference.name)
  );
}

function useExpansion(keyspace: string) {
  const storageKey = `mnemo.related:${keyspace}`;
  const [state, setState] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  });
  function set(key: string, value: boolean) {
    setState((previous) => {
      const next = { ...previous, [key]: value };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Expansion falls back to defaults when storage is unavailable.
      }
      return next;
    });
  }
  return [state, set] as const;
}

export function RelatedPanel({
  title = "Related resources",
  items,
  groups: declaredGroups = [],
  isLoading = false,
  emptyMessage = "No related resources",
  errorMessage: sourceErrorMessage,
  onRetry,
  detailLabel,
  relation,
  presentation,
  listHref,
  exclude = [],
}: {
  title?: string;
  /** References grouped by kind; panel-level state applies to these groups. */
  items?: RelatedPanelItem[];
  groups?: RelatedGroup[];
  isLoading?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => unknown;
  detailLabel?: string;
  relation?: string;
  /** Presentation for groups built from `items`. */
  presentation?: RelatedGroup["presentation"];
  /** List URL for each kind built from `items`, for summary presentation. */
  listHref?: (kind: string) => string | undefined;
  /** References the Summary already shows; Related never repeats them. */
  exclude?: ResourceReference[];
}) {
  const pathname = usePathname();
  const retrievalError = useContext(RelatedErrorContext);
  const denied =
    !!retrievalError &&
    "status" in retrievalError &&
    (retrievalError.status === 401 || retrievalError.status === 403);
  const explain = (message?: string) =>
    message && denied ? DENIED_MESSAGE : message;
  const errorMessage = explain(sourceErrorMessage);

  const excluded = new Set(exclude.map(referenceKey));
  let removed = 0;
  const groups: RelatedGroup[] = [
    ...declaredGroups.map((group) => ({
      ...group,
      // Plain names inherit the group's kind; "Kind/[ns/]name" references resolve themselves.
      items: group.items.map((item) =>
        item.kind || item.name.includes("/")
          ? item
          : { ...item, kind: group.kind },
      ),
      errorMessage: explain(group.errorMessage),
    })),
    ...groupByKind(items ?? [], { detailLabel, relation, presentation }).map(
      (group) => ({ ...group, listHref: listHref?.(group.kind) }),
    ),
  ].flatMap((group) => {
    const kept = group.items.filter(
      (item) => !excluded.has(referenceKey(item)),
    );
    removed += group.items.length - kept.length;
    // A group emptied only because Summary shows its members has nothing left to say.
    return group.items.length > 0 && kept.length === 0
      ? []
      : [{ ...group, items: kept }];
  });

  const infoKinds = [
    ...new Set(
      groups
        .filter((group) => group.items.length)
        .map((group) => relatedResourceKind(group.kind)),
    ),
  ].filter((kind) => resourceApiPaths[kind]);
  const infoQueries = useQueries({
    queries: infoKinds.map((kind) => ({
      queryKey: resourceKeys.list(kind, {}),
      queryFn: () =>
        apiFetch<ResourceList<K8sResource>>(`/${resourceApiPaths[kind]}`),
      enabled: !isLoading && !errorMessage,
      retry: false,
      staleTime: 10000,
    })),
  }) as InfoQuery[];

  const [query, setQuery] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [expanded, setExpanded] = useExpansion(pathname);

  const resolved: ResolvedGroup[] = groups.map((group) => {
    const info =
      infoQueries[infoKinds.indexOf(relatedResourceKind(group.kind))];
    const rows = group.items
      .map((item) => {
        const reference = resolveResourceReference(item);
        const resource = info?.data?.items.find(
          (candidate) =>
            candidate.metadata.name === reference.name &&
            candidate.metadata.namespace === reference.namespace,
        );
        return {
          item,
          reference,
          resource,
          status: item.status ?? resource?.status.level,
        };
      })
      .sort(bySeverity);
    return {
      ...group,
      key: group.kind,
      label:
        resolveResourceReference({ kind: group.kind, name: "" }).label ||
        "Resource",
      rows,
      info,
    };
  });

  const total = resolved.reduce((sum, group) => sum + group.rows.length, 0);
  const pending = isLoading || resolved.some((group) => group.isLoading);
  const anyIssues = resolved.some((group) => group.rows.some(isIssue));
  const needle = query.trim().toLowerCase();
  const visibleGroups = resolved
    .map((group) => {
      const kindMatch = needle && group.label.toLowerCase().includes(needle);
      const rows = group.rows.filter(
        (row) =>
          (!issuesOnly || isIssue(row)) &&
          (!needle ||
            kindMatch ||
            row.reference.name.toLowerCase().includes(needle)),
      );
      return { ...group, rows };
    })
    .filter(
      (group) =>
        group.isLoading ||
        group.errorMessage ||
        group.rows.length ||
        (!needle && !issuesOnly),
    );

  // Summary already shows every remaining reference, so Related has nothing to add.
  if (
    removed > 0 &&
    total === 0 &&
    !pending &&
    !errorMessage &&
    !resolved.some((group) => group.errorMessage)
  )
    return null;

  const summaryGroups = visibleGroups.filter(
    (group) =>
      group.presentation === "summary" &&
      !group.isLoading &&
      !group.errorMessage,
  );
  const rowGroups = visibleGroups.filter(
    (group) => !summaryGroups.includes(group),
  );
  const small = rowGroups.filter(
    (group) =>
      !group.isLoading &&
      !group.errorMessage &&
      group.rows.length > 0 &&
      group.rows.length <= SMALL_GROUP &&
      !group.rows.some(isIssue),
  );
  const cards: ResolvedGroup[] =
    small.length >= 3
      ? [
          ...rowGroups.filter((group) => !small.includes(group)),
          {
            kind: "",
            key: "other",
            label: "Other related",
            merged: true,
            items: small.flatMap((group) => group.items),
            rows: small.flatMap((group) => group.rows).sort(bySeverity),
          },
        ]
      : rowGroups;
  const many = cards.length >= 4 || total > 20;
  const isExpanded = (group: ResolvedGroup, index: number) =>
    expanded[group.key] ??
    (!many ||
      index === 0 ||
      group.rows.some(isIssue) ||
      !!needle ||
      issuesOnly);
  const populated = visibleGroups.some(
    (group) => group.rows.length || group.isLoading || group.errorMessage,
  );
  const allEmpty = !pending && !errorMessage && !populated;
  const showFilter =
    !isLoading &&
    (cards.length + summaryGroups.length >= 3 || total > 20 || !!needle);

  function reveal(key: string) {
    setExpanded(key, true);
    requestAnimationFrame(() =>
      document
        .getElementById(`related-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <section aria-label={title} data-slot="related-panel" className="space-y-3">
      <SectionHeader
        title={title}
        count={pending || errorMessage ? undefined : total}
        countLoading={pending}
        countLabel={`${total} related resources`}
        action={
          <>
            {anyIssues && !pending && (
              <Button
                variant="outline"
                size="sm"
                aria-pressed={issuesOnly}
                onClick={() => setIssuesOnly((value) => !value)}
                className={cn(issuesOnly && "bg-muted")}
              >
                Issues only
              </Button>
            )}
            {showFilter && (
              <div className="relative">
                <Search
                  aria-hidden
                  className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={`Filter ${title.toLowerCase()}`}
                  placeholder="Filter by name or kind…"
                  className="h-8 w-56 pl-8 text-sm"
                />
              </div>
            )}
          </>
        }
      />
      {cards.length >= 4 && !pending && !errorMessage && (
        <nav aria-label={`${title} by type`} className="flex flex-wrap gap-1.5">
          {cards.map((group) => {
            const issues = group.rows.filter(isIssue).length;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => reveal(group.key)}
                className="hover:bg-accent/60 focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
              >
                {group.label}
                <span className="text-muted-foreground tabular-nums">
                  {group.rows.length}
                </span>
                {issues > 0 && (
                  <span className="text-status-warning inline-flex items-center gap-1 tabular-nums">
                    <StatusDot level="Warning" />
                    {issues}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
      <div aria-busy={pending} className="space-y-3">
        {isLoading ? (
          <TableSkeleton label={title} />
        ) : errorMessage ? (
          <InlineAlert
            message={errorMessage}
            denied={denied}
            onRetry={onRetry}
          />
        ) : allEmpty ? (
          <p className="text-muted-foreground flex items-center gap-2 py-1 text-sm">
            <Link2 aria-hidden className="size-4 shrink-0" />
            {needle || issuesOnly
              ? "No related resources match these filters"
              : groups.length === 1 && groups[0].emptyMessage
                ? groups[0].emptyMessage
                : emptyMessage}
          </p>
        ) : (
          <>
            {summaryGroups.length > 0 && (
              <RelatedKindSummary groups={summaryGroups} />
            )}
            {cards.map((group, index) => (
              <RelatedGroupCard
                key={group.key}
                group={group}
                denied={denied}
                expanded={isExpanded(group, index)}
                onToggle={(value) => setExpanded(group.key, value)}
                filtered={!!needle || issuesOnly}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function RelatedGroupCard({
  group,
  denied,
  expanded,
  onToggle,
  filtered,
}: {
  group: ResolvedGroup;
  denied: boolean;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  filtered: boolean;
}) {
  const bodyId = useId();
  const count = group.rows.length;
  const tally = ISSUES.map((level) => ({
    level,
    count: group.rows.filter((row) => row.status === level).length,
  })).filter((entry) => entry.count);
  const collapsible = !group.isLoading && !group.errorMessage && count > 0;
  const open = collapsible ? expanded : true;
  const header = (
    <>
      {createElement(group.merged ? Link2 : relatedKindIcon(group.kind), {
        "aria-hidden": true,
        className: "text-muted-foreground size-4 shrink-0",
      })}
      <span className="text-[13px] font-medium">{group.label}</span>
      <CountBadge
        value={group.isLoading ? undefined : count}
        loading={group.isLoading}
      />
      {group.relation && (
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          · {group.relation}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3 text-xs">
        {tally.map(({ level, count }) => (
          <span
            key={level}
            className={cn(
              "inline-flex items-center gap-1.5",
              statusTone(level).text,
            )}
          >
            <StatusDot level={level} />
            {count} {level}
          </span>
        ))}
        {collapsible && (
          <ChevronDown
            aria-hidden
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              !open && "-rotate-90",
            )}
          />
        )}
      </span>
    </>
  );
  return (
    <section
      id={`related-${group.key}`}
      aria-label={`${group.label} (${count})`}
      className="scroll-mt-14 overflow-hidden rounded-lg border"
    >
      <h3 className={cn("bg-muted/50", open && "border-b")}>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => onToggle(!open)}
            className="hover:bg-muted focus-visible:ring-ring/50 flex h-10 w-full items-center gap-2 px-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            {header}
          </button>
        ) : (
          <div className="flex h-10 items-center gap-2 px-3">{header}</div>
        )}
      </h3>
      {open && (
        <div id={bodyId}>
          {group.isLoading ? (
            <RowsSkeleton label={group.label} />
          ) : group.errorMessage ? (
            <div className="p-3">
              <InlineAlert
                message={group.errorMessage}
                denied={denied}
                onRetry={group.onRetry}
              />
            </div>
          ) : count === 0 ? (
            <p className="text-muted-foreground px-3 py-2.5 text-sm">
              {group.emptyMessage ??
                `No related ${pluralize(group.label).toLowerCase()}`}
            </p>
          ) : (
            <RelatedRows group={group} filtered={filtered} />
          )}
        </div>
      )}
    </section>
  );
}

function RelatedRows({
  group,
  filtered,
}: {
  group: ResolvedGroup;
  filtered: boolean;
}) {
  const navigate = useResourceNavigation();
  const contextNamespace = useContext(RelatedNamespaceContext);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const { rows, info, label } = group;
  const count = rows.length;
  const columns: RelatedColumn[] = group.merged
    ? [
        {
          id: "age",
          header: "Age",
          value: (resource) =>
            resource.metadata.createdAt
              ? formatAge(resource.metadata.createdAt)
              : undefined,
        },
      ]
    : info
      ? relatedColumns(group.kind)
      : [];
  const infoPending = group.merged
    ? rows.some((row) => !row.resource && !row.status)
    : !!info && info.isPending && !info.isError;
  const showNamespace =
    rows.some((row) => row.reference.namespace) &&
    !rows.every((row) => row.reference.namespace === contextNamespace);
  const showStatus = infoPending || rows.some((row) => row.status);
  const showDetail = rows.some((row) => row.item.detail !== undefined);
  const pages = Math.ceil(count / PAGE_ROWS);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const expanded = showAll || filtered;
  const visible = expanded
    ? rows.slice(currentPage * PAGE_ROWS, (currentPage + 1) * PAGE_ROWS)
    : rows.slice(0, PREVIEW_ROWS);
  const hidden = rows.slice(PREVIEW_ROWS);
  const compact = expanded && count > PAGE_ROWS;
  const cellY = compact ? "py-1" : "py-2";

  function nameCell(row: ResolvedRow) {
    const { reference, item } = row;
    const name = reference.name || item.name;
    if (!reference.href)
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate" title={name}>
            {name}
          </span>
          <Info
            aria-hidden
            className="text-muted-foreground size-3.5 shrink-0"
          />
          <span className="sr-only">Detail view unavailable</span>
        </span>
      );
    return (
      <Link
        href={navigate(reference.href)}
        title={name}
        aria-label={`View ${reference.label} ${reference.name}${reference.namespace ? ` in ${reference.namespace}` : ""}`}
        className="hover:text-primary focus-visible:ring-ring/50 block truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {name}
      </Link>
    );
  }
  function cell(value: ReactNode) {
    if (value !== undefined && value !== null && value !== "") return value;
    return infoPending ? (
      <Skeleton className="h-3.5 w-12" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  const head = "text-muted-foreground h-9 px-3 text-xs font-normal";

  return (
    <>
      {info?.isError && (
        <p
          role="status"
          className="text-muted-foreground flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs"
        >
          <Info aria-hidden className="size-3.5 shrink-0" />
          {(info.error as { status?: number })?.status === 403
            ? "Insufficient permissions to load additional resource details."
            : "Additional resource details could not be loaded."}
          <Button variant="ghost" size="xs" onClick={() => info.refetch()}>
            Retry
          </Button>
        </p>
      )}
      <div className="hidden md:block">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>Name</TableHead>
              {group.merged && <TableHead className={head}>Kind</TableHead>}
              {showNamespace && (
                <TableHead className={head}>Namespace</TableHead>
              )}
              {showStatus && <TableHead className={head}>Status</TableHead>}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(head, column.align === "end" && "text-right")}
                >
                  {column.header}
                </TableHead>
              ))}
              {showDetail && (
                <TableHead className={head}>
                  {group.detailLabel ?? "Details"}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, index) => (
              <TableRow
                key={`${row.reference.kind}/${row.reference.namespace}/${row.reference.name}/${index}`}
              >
                <TableCell className={cn("max-w-80 px-3", cellY)}>
                  {nameCell(row)}
                </TableCell>
                {group.merged && (
                  <TableCell
                    className={cn("text-muted-foreground px-3", cellY)}
                  >
                    {row.reference.label}
                  </TableCell>
                )}
                {showNamespace && (
                  <TableCell
                    className={cn(
                      "text-muted-foreground max-w-48 truncate px-3",
                      cellY,
                    )}
                  >
                    {row.reference.namespace ?? "—"}
                  </TableCell>
                )}
                {showStatus && (
                  <TableCell className={cn("px-3", cellY)}>
                    {cell(
                      row.status && (
                        <StatusBadge level={row.status} variant="dot" />
                      ),
                    )}
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      "max-w-56 truncate px-3 tabular-nums",
                      cellY,
                      column.align === "end" && "text-right",
                    )}
                  >
                    {cell(row.resource && column.value(row.resource))}
                  </TableCell>
                ))}
                {showDetail && (
                  <TableCell
                    className={cn("text-muted-foreground px-3", cellY)}
                  >
                    {row.item.detail ?? "—"}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {visible.map((row, index) => {
          const facts = [
            ...(group.merged ? [["Kind", row.reference.label]] : []),
            ...(showNamespace && row.reference.namespace
              ? [["Namespace", row.reference.namespace]]
              : []),
            ...columns.flatMap((column) => {
              const value = row.resource && column.value(row.resource);
              return value ? [[column.header, value]] : [];
            }),
          ];
          return (
            <li
              key={`${row.reference.kind}/${row.reference.namespace}/${row.reference.name}/${index}`}
              className="space-y-1 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm">{nameCell(row)}</div>
                {row.status && <StatusBadge level={row.status} variant="dot" />}
              </div>
              {(facts.length > 0 || row.item.detail) && (
                <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {facts.map(([factLabel, value]) => (
                    <span key={factLabel}>
                      {factLabel}{" "}
                      <span className="text-foreground">{value}</span>
                    </span>
                  ))}
                  {row.item.detail && <span>{row.item.detail}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {(count > PREVIEW_ROWS || (expanded && pages > 1)) && !filtered && (
        <div className="flex flex-wrap items-center gap-3 border-t px-3 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2"
            aria-expanded={showAll}
            onClick={() => {
              setShowAll((value) => !value);
              setPage(0);
            }}
          >
            {showAll
              ? `Show fewer ${pluralize(label)}`
              : hidden.every((row) => row.status === "Healthy")
                ? `+ ${hidden.length} healthy`
                : `Show all ${count} ${pluralize(label)}`}
          </Button>
          {showAll && pages > 1 && (
            <nav
              aria-label={`${label} pages`}
              className="text-muted-foreground ml-auto flex items-center gap-1 text-xs tabular-nums"
            >
              <Button
                variant="ghost"
                size="xs"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                size="xs"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}
    </>
  );
}

function RowsSkeleton({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">Loading {label}</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex gap-6 border-b px-3 py-3 last:border-0"
        >
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/50 flex h-10 items-center gap-3 border-b px-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-5 w-6 rounded-md" />
      </div>
      <RowsSkeleton label={label} />
    </div>
  );
}

function InlineAlert({
  message,
  denied,
  onRetry,
}: {
  message: string;
  denied: boolean;
  onRetry?: () => unknown;
}) {
  const Icon = denied ? ShieldAlert : AlertCircle;
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
    >
      <Icon aria-hidden className="text-destructive size-4 shrink-0" />
      <p className="text-destructive min-w-0 flex-1 text-sm">{message}</p>
      {onRetry && !denied && (
        <Button variant="outline" size="sm" onClick={() => onRetry()}>
          Retry
        </Button>
      )}
    </div>
  );
}
