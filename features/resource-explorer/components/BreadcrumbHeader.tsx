import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function BreadcrumbHeader({
  segments,
}: {
  segments: BreadcrumbSegment[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1.5 text-sm"
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span
            key={`${i}:${segment.label}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            {i > 0 && (
              <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            )}
            {!isLast && segment.href ? (
              <Link
                href={segment.href}
                className="hover:text-foreground focus-visible:outline-ring rounded-sm break-all transition-colors focus-visible:outline-2"
              >
                {segment.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={
                  isLast ? "text-foreground font-medium break-all" : "break-all"
                }
              >
                {segment.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
