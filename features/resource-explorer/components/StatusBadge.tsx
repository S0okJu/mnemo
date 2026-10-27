import {
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceStatusLevel } from "@/lib/api/types";

const statusConfig: Record<
  ResourceStatusLevel,
  {
    icon: typeof CheckCircle2;
    text: string;
    bg: string;
    subtle: string;
    border: string;
  }
> = {
  Healthy: {
    icon: CheckCircle2,
    text: "text-status-healthy",
    bg: "bg-status-healthy",
    subtle: "bg-status-healthy/10",
    border: "border-status-healthy/25",
  },
  Progressing: {
    icon: CircleDashed,
    text: "text-status-progressing",
    bg: "bg-status-progressing",
    subtle: "bg-status-progressing/10",
    border: "border-status-progressing/25",
  },
  Warning: {
    icon: AlertTriangle,
    text: "text-status-warning",
    bg: "bg-status-warning",
    subtle: "bg-status-warning/10",
    border: "border-status-warning/25",
  },
  Error: {
    icon: XCircle,
    text: "text-status-error",
    bg: "bg-status-error",
    subtle: "bg-status-error/10",
    border: "border-status-error/25",
  },
  Unknown: {
    icon: HelpCircle,
    text: "text-status-unknown",
    bg: "bg-status-unknown",
    subtle: "bg-status-unknown/10",
    border: "border-status-unknown/25",
  },
};

/** Class names for one status, shared by badges, dots, tallies, and bars. */
export function statusTone(level: ResourceStatusLevel) {
  return statusConfig[level];
}

export function StatusDot({
  level,
  className,
}: {
  level: ResourceStatusLevel;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        statusConfig[level].bg,
        className,
      )}
    />
  );
}

export function StatusBadge({
  level,
  label = level,
  variant = "badge",
}: {
  level: ResourceStatusLevel;
  label?: string;
  variant?: "badge" | "dot";
}) {
  const config = statusConfig[level];
  const Icon = config.icon;

  if (variant === "dot")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <StatusDot level={level} />
        {label}
      </span>
    );

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        config.text,
        config.subtle,
        config.border,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
