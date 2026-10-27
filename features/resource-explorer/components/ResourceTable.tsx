"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from "lucide-react";
import {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/resource-explorer/components/EmptyState";
import type { ListSort } from "@/features/resource-explorer/lib/list-state";
import type { K8sResource } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type TableDensity = "comfortable" | "compact";

// Column ids and accessors that map onto URL-backed list sort keys.
const SORT_KEYS: Record<string, ListSort> = {
  "metadata.name": "name",
  metadata_name: "name",
  name: "name",
  "metadata.namespace": "namespace",
  metadata_namespace: "namespace",
  namespace: "namespace",
  kind: "kind",
  status: "severity",
  age: "age",
};
const NUMERIC_COLUMNS = new Set([
  "restarts",
  "replicas",
  "ready",
  "desired",
  "current",
  "available",
  "keys",
  "rules",
  "completions",
]);

export function ResourceTable<T extends K8sResource<unknown, unknown>>({
  columns,
  data,
  isLoading,
  emptyLabel,
  onSelect,
  getDetailHref,
  enableSorting = true,
  sort,
  direction = "asc",
  onSortChange,
  density = "comfortable",
}: {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  emptyLabel: string;
  onSelect?: (namespace: string | undefined, name: string) => void;
  getDetailHref?: (resource: T) => string;
  enableSorting?: boolean;
  /** Current URL sort; when provided with onSortChange, headers sort via the URL. */
  sort?: ListSort;
  direction?: "asc" | "desc";
  onSortChange?: (sort?: ListSort, direction?: "asc" | "desc") => void;
  density?: TableDensity;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    enableSorting: enableSorting && !onSortChange,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div role="status" className="overflow-hidden rounded-lg border">
        <span className="sr-only">Loading resources</span>
        <div className="bg-muted/40 flex gap-6 border-b px-3 py-3">
          {columns.map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div
            key={row}
            className="flex gap-6 border-b px-3 py-3.5 last:border-0"
          >
            {columns.map((_, i) => (
              <Skeleton
                key={i}
                className={cn("h-3.5 flex-1", i === 0 && "flex-[2]")}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed">
        <EmptyState
          icon={Inbox}
          title="No resources found"
          description={emptyLabel}
        />
      </div>
    );
  }

  const cellPadding = density === "compact" ? "py-1" : "py-2";

  return (
    <div
      data-slot="table-container"
      className="relative max-h-[calc(100svh-12rem)] w-full overflow-auto rounded-lg border"
    >
      <table data-slot="table" className="w-full caption-bottom text-sm">
        <TableHeader className="bg-background sticky top-0 z-[1] shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const id = header.column.id;
                const sortKey = onSortChange ? SORT_KEYS[id] : undefined;
                const active = sortKey !== undefined && sort === sortKey;
                const numeric = NUMERIC_COLUMNS.has(id);
                const label = flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                );
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sortKey
                        ? active
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "bg-muted/40 text-muted-foreground h-9 px-3 text-xs select-none",
                      numeric && "text-right",
                      header.column.getCanSort() && "cursor-pointer",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {sortKey ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!active) onSortChange!(sortKey, "asc");
                          else if (direction === "asc")
                            onSortChange!(sortKey, "desc");
                          else onSortChange!(undefined, undefined);
                        }}
                        className={cn(
                          "hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none",
                          active && "text-foreground",
                        )}
                        title={
                          sortKey === "severity"
                            ? "Sort by severity (most severe first)"
                            : undefined
                        }
                      >
                        {label}
                        {active ? (
                          direction === "asc" ? (
                            <ArrowUp aria-hidden className="size-3" />
                          ) : (
                            <ArrowDown aria-hidden className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown
                            aria-hidden
                            className="size-3 opacity-40"
                          />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() =>
                onSelect?.(
                  row.original.metadata.namespace,
                  row.original.metadata.name,
                )
              }
            >
              {row.getVisibleCells().map((cell, index) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "px-3",
                    cellPadding,
                    NUMERIC_COLUMNS.has(cell.column.id) &&
                      "text-right tabular-nums",
                    index === 0 && "max-w-80",
                  )}
                >
                  {index === 0 && getDetailHref ? (
                    <Link
                      href={getDetailHref(row.original)}
                      title={row.original.metadata.name}
                      className="hover:text-primary focus-visible:ring-ring/50 block truncate rounded-sm py-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Link>
                  ) : (
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
