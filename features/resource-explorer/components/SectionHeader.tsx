import Link from "next/link";
import type { ReactNode } from "react";
import { CountBadge } from "./CountBadge";

/** The standard secondary link on the right of a section title. */
export function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {label} →
    </Link>
  );
}

export function SectionHeader({
  title,
  count,
  countLoading,
  countLabel,
  caption,
  action,
  link,
  as: Heading = "h2",
  id,
}: {
  title: ReactNode;
  count?: number;
  countLoading?: boolean;
  countLabel?: string;
  caption?: ReactNode;
  action?: ReactNode;
  link?: { href: string; label: string };
  as?: "h2" | "h3";
  id?: string;
}) {
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
      <Heading id={id} className="text-foreground text-sm font-semibold">
        {title}
      </Heading>
      <CountBadge value={count} loading={countLoading} label={countLabel} />
      {caption && (
        <span className="text-muted-foreground min-w-0 text-xs">{caption}</span>
      )}
      {(action || link) && (
        <div className="ml-auto flex items-center gap-3">
          {action}
          {link && <SectionLink {...link} />}
        </div>
      )}
    </div>
  );
}
