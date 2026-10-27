"use client";

import type { ResourceStatusLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { CountBadge } from "./CountBadge";

/** A small group of mutually exclusive toggle buttons for in-page filtering. */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: {
    value: T;
    label: string;
    count?: number;
    tone?: ResourceStatusLevel;
  }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted/60 inline-flex h-8 items-center gap-0.5 rounded-lg p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <CountBadge value={option.count} tone={option.tone} />
            )}
          </button>
        );
      })}
    </div>
  );
}
