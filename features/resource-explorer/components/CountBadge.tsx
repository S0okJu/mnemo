import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResourceStatusLevel } from "@/lib/api/types";
import { statusTone } from "./StatusBadge";

/** A count shown next to a title. Unknown counts render a skeleton, never 0. */
export function CountBadge({
  value,
  loading = false,
  tone = "count",
  label,
  decorative = false,
}: {
  value?: number;
  loading?: boolean;
  tone?: "count" | ResourceStatusLevel;
  label?: string;
  /** Draw the number with CSS only, keeping it out of the parent's text content. */
  decorative?: boolean;
}) {
  if (loading || value === undefined)
    return loading ? (
      <Skeleton aria-hidden className="h-5 w-6 rounded-md" />
    ) : null;
  const zero = value === 0;
  return (
    <span
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      data-count={decorative ? value : undefined}
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-medium tabular-nums",
        decorative && "after:content-[attr(data-count)]",
        zero
          ? "bg-muted text-muted-foreground"
          : tone === "count"
            ? "bg-count-subtle text-count"
            : cn(statusTone(tone).text, statusTone(tone).subtle),
      )}
    >
      {decorative ? null : value}
    </span>
  );
}
