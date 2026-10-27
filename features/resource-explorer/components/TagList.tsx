"use client";

import { useState } from "react";

const VISIBLE_LIMIT = 8;

export function TagList({ labels }: { labels?: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(labels ?? {});

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No labels</p>;
  }

  const visible = expanded ? entries : entries.slice(0, VISIBLE_LIMIT);
  const hiddenCount = entries.length - visible.length;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {visible.map(([key, value]) => (
        <li
          key={key}
          className="bg-muted/60 inline-flex h-6 max-w-full items-center rounded-md px-2 font-mono text-xs"
          title={`${key}=${value}`}
        >
          <span className="truncate">{key}</span>
          <span className="text-muted-foreground truncate">={value}</span>
        </li>
      ))}
      {(hiddenCount > 0 || (expanded && entries.length > VISIBLE_LIMIT)) && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 h-6 rounded-md px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            {expanded ? "Show fewer" : `+${hiddenCount} more`}
          </button>
        </li>
      )}
    </ul>
  );
}
