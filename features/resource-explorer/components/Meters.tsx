import type { ResourceStatusLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { statusTone } from "./StatusBadge";

export const STATUS_DISPLAY_ORDER: ResourceStatusLevel[] = [
  "Healthy",
  "Progressing",
  "Warning",
  "Error",
  "Unknown",
];

const TRACK = "bg-muted flex h-1.5 w-full overflow-hidden rounded-full";

/** Proportional status distribution; the only bar that uses status colors. */
export function StatusBar({
  counts,
  total,
  className,
}: {
  counts: Partial<Record<ResourceStatusLevel, number>>;
  total: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(TRACK, className)}>
      {total > 0 &&
        STATUS_DISPLAY_ORDER.map((level) =>
          counts[level] ? (
            <div
              key={level}
              className={statusTone(level).bg}
              style={{ width: `${(counts[level]! / total) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}

/** Utilization with a neutral fill; turns warning at 80% and error at 95%. */
export function CapacityMeter({
  used,
  total,
  label,
  className,
}: {
  used: number;
  total: number;
  label: string;
  className?: string;
}) {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${used} of ${total} used, ${percent}%`}
      className={cn(TRACK, className)}
    >
      <div
        className={cn(
          "h-full rounded-full",
          percent >= 95
            ? "bg-status-error"
            : percent >= 80
              ? "bg-status-warning"
              : "bg-foreground/60",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function statusCounts(levels: ResourceStatusLevel[]) {
  const counts: Partial<Record<ResourceStatusLevel, number>> = {};
  for (const level of levels) counts[level] = (counts[level] ?? 0) + 1;
  return counts;
}
