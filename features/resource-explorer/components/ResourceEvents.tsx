"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3, Info } from "lucide-react";
import { getResourceType } from "@/lib/resource-registry/registry";
import type { ResourceEvent } from "@/lib/resource-registry/types";
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
import { formatAge } from "@/lib/utils/format";
import { EmptyState } from "./EmptyState";
import { QueryError } from "./QueryError";
import { SegmentedControl } from "./SegmentedControl";

export function resourceEventsKey(
  kind: string,
  namespace: string | undefined,
  name: string,
) {
  return ["resources", kind, namespace ?? "_", name, "events"];
}

/** Events may carry ISO timestamps or preformatted text such as "2h ago". */
function eventTime(time: string) {
  const parsed = Date.parse(time);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function ResourceEvents({
  kind,
  namespace,
  name,
}: {
  kind: string;
  namespace?: string;
  name: string;
}) {
  const definition = getResourceType(kind);
  const [filter, setFilter] = useState<"all" | "warnings">("all");
  const query = useQuery({
    queryKey: resourceEventsKey(kind, namespace, name),
    queryFn: () => definition.fetchEvents!(namespace, name),
    enabled: !!definition.fetchEvents,
    refetchInterval: 10000,
    retry: false,
  });
  if (!definition.fetchEvents)
    return (
      <EmptyState
        icon={Clock3}
        title="Events unavailable"
        description="This resource type does not provide event data."
      />
    );
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        onRetry={() => query.refetch()}
        subject="events"
      />
    );
  if (query.isPending)
    return (
      <div role="status" className="overflow-hidden rounded-lg border">
        <span className="sr-only">Loading events</span>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b px-3 py-3 last:border-0"
          >
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    );
  if (!query.data.length)
    return (
      <EmptyState
        icon={Clock3}
        title="No events"
        description="No events are currently available for this resource."
      />
    );
  const timestamps = query.data.map((event) => eventTime(event.time));
  const sortable = timestamps.every((time) => time !== undefined);
  const events = sortable
    ? [...query.data].sort((a, b) => eventTime(b.time)! - eventTime(a.time)!)
    : query.data;
  const warnings = events.filter((event) => event.type === "Warning").length;
  const visible =
    filter === "warnings"
      ? events.filter((event) => event.type === "Warning")
      : events;
  const showReason = events.some((event) => event.reason || event.type);
  const showCount = events.some(
    (event) => typeof (event as { count?: number }).count === "number",
  );
  return (
    <section aria-label="Resource events" className="space-y-3">
      {warnings > 0 && (
        <SegmentedControl
          label="Filter events"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: events.length },
            {
              value: "warnings",
              label: "Warnings",
              count: warnings,
              tone: "Warning",
            },
          ]}
        />
      )}
      {visible.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">No warning events.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground h-9 w-10 px-3 text-xs">
                  <span className="sr-only">Type</span>
                </TableHead>
                {showReason && (
                  <TableHead className="text-muted-foreground h-9 px-3 text-xs">
                    Reason
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground h-9 px-3 text-xs">
                  Message
                </TableHead>
                {showCount && (
                  <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs">
                    Count
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs">
                  Age
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((event, index) => (
                <EventRow
                  key={`${event.time}/${index}`}
                  event={event}
                  showReason={showReason}
                  showCount={showCount}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function EventRow({
  event,
  showReason,
  showCount,
}: {
  event: ResourceEvent;
  showReason: boolean;
  showCount: boolean;
}) {
  const warning = event.type === "Warning";
  const time = eventTime(event.time);
  return (
    <TableRow className={cn(warning && "bg-status-warning/5")}>
      <TableCell className="px-3 py-2.5 align-top">
        {warning ? (
          <AlertTriangle
            aria-label="Warning"
            className="text-status-warning size-4"
          />
        ) : (
          <Info aria-label="Normal" className="text-muted-foreground size-4" />
        )}
      </TableCell>
      {showReason && (
        <TableCell
          className={cn(
            "px-3 py-2.5 align-top text-xs font-medium",
            warning ? "text-status-warning" : "text-muted-foreground",
          )}
        >
          {event.reason ?? event.type}
        </TableCell>
      )}
      <TableCell className="min-w-64 px-3 py-2.5 align-top text-sm whitespace-normal">
        {event.message}
      </TableCell>
      {showCount && (
        <TableCell className="px-3 py-2.5 text-right align-top tabular-nums">
          {(event as { count?: number }).count ?? "—"}
        </TableCell>
      )}
      <TableCell className="text-muted-foreground px-3 py-2.5 text-right align-top text-xs">
        {time ? (
          <time dateTime={event.time} title={new Date(time).toLocaleString()}>
            {formatAge(event.time)} ago
          </time>
        ) : (
          event.time
        )}
      </TableCell>
    </TableRow>
  );
}
