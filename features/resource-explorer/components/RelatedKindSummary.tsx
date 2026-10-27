"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FolderTree } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/utils/format";
import { relatedKindIcon } from "../lib/related-resource-info";
import { CountBadge } from "./CountBadge";
import { StatusBar, statusCounts } from "./Meters";
import { StatusDot, statusTone } from "./StatusBadge";
import { useResourceNavigation } from "./ResourceNavigation";
import type { ResolvedRow } from "./related-panel";

const TALLY = ["Error", "Warning", "Progressing", "Unknown"] as const;
/** Progressing usually resolves by itself, so it is counted but not listed. */
const ACTIONABLE = ["Error", "Warning", "Unknown"];
const VISIBLE_ISSUES = 8;

/**
 * A containment relation (everything in a namespace, every pod on a node) can be
 * unbounded, so it is shown as counts per kind plus only the rows that need attention.
 */
export function RelatedKindSummary({
  groups,
}: {
  groups: {
    key: string;
    kind: string;
    label: string;
    relation?: string;
    listHref?: string;
    rows: ResolvedRow[];
  }[];
}) {
  const navigate = useResourceNavigation();
  const [showAll, setShowAll] = useState(false);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const issues = groups
    .flatMap((group) =>
      group.rows
        .filter((row) => row.status && ACTIONABLE.includes(row.status))
        .map((row) => ({ ...row, label: group.label })),
    )
    .sort(
      (a, b) =>
        ACTIONABLE.indexOf(a.status!) - ACTIONABLE.indexOf(b.status!) ||
        a.reference.name.localeCompare(b.reference.name),
    );
  const visibleIssues = showAll ? issues : issues.slice(0, VISIBLE_ISSUES);
  const head = "text-muted-foreground h-9 px-3 text-xs font-normal";
  return (
    <>
      <section
        aria-label={groups[0].relation ?? "Summary"}
        className="overflow-hidden rounded-lg border"
      >
        <h3 className="bg-muted/50 flex h-10 items-center gap-2 border-b px-3">
          <FolderTree aria-hidden className="text-muted-foreground size-4" />
          <span className="text-[13px] font-medium">
            {groups[0].relation ?? "Summary"}
          </span>
          <CountBadge value={total} />
        </h3>
        <Table aria-label="Related resources by type">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>Type</TableHead>
              <TableHead className={cn(head, "text-right")}>Count</TableHead>
              <TableHead className={cn(head, "w-1/4")}>Health</TableHead>
              <TableHead className={head}>Issues</TableHead>
              <TableHead className={head}>
                <span className="sr-only">List</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const Icon = relatedKindIcon(group.kind);
              const known = group.rows.filter((row) => row.status);
              const counts = statusCounts(known.map((row) => row.status!));
              return (
                <TableRow key={group.key}>
                  <TableCell className="px-3 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon
                        aria-hidden
                        className="text-muted-foreground size-4 shrink-0"
                      />
                      {group.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">
                    {group.rows.length}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <StatusBar counts={counts} total={known.length} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <span className="flex flex-wrap gap-x-3">
                      {TALLY.filter((level) => counts[level]).map((level) => (
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
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    {group.listHref && (
                      <Link
                        href={group.listHref}
                        aria-label={`Open ${group.label} list`}
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                      >
                        Open list →
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
      {issues.length > 0 && (
        <section
          aria-label={`Issues (${issues.length})`}
          className="overflow-hidden rounded-lg border"
        >
          <h3 className="bg-muted/50 flex h-10 items-center gap-2 border-b px-3">
            <AlertTriangle
              aria-hidden
              className="text-muted-foreground size-4"
            />
            <span className="text-[13px] font-medium">Needs attention</span>
            <CountBadge value={issues.length} tone="Warning" />
          </h3>
          <ul className="divide-y">
            {visibleIssues.map((row) => (
              <li
                key={`${row.reference.kind}/${row.reference.namespace}/${row.reference.name}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-sm md:grid-cols-[auto_minmax(0,16rem)_minmax(0,10rem)_minmax(0,1fr)_auto]"
              >
                <StatusDot level={row.status!} />
                {row.reference.href ? (
                  <Link
                    href={navigate(row.reference.href)}
                    aria-label={`View ${row.reference.label} ${row.reference.name}${row.reference.namespace ? ` in ${row.reference.namespace}` : ""}`}
                    className="hover:text-primary truncate font-medium underline-offset-4 hover:underline"
                  >
                    {row.reference.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium">
                    {row.reference.name}
                  </span>
                )}
                <span className="text-muted-foreground hidden truncate text-xs md:block">
                  {row.reference.label}
                </span>
                <span
                  title={row.resource?.status.message}
                  className="text-muted-foreground hidden truncate md:block"
                >
                  {row.resource?.status.message ?? "—"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {row.resource?.metadata.createdAt
                    ? formatAge(row.resource.metadata.createdAt)
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {issues.length > VISIBLE_ISSUES && (
            <div className="border-t px-3 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground -ml-2"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? "Show fewer issues"
                  : `Show all ${issues.length} issues`}
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
