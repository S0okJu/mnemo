import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export function ResourcePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-muted-foreground text-xs tabular-nums">
        {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} of {total} resources
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Rows per page
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-8 rounded-lg border px-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            {[10, 25, 50].map((size) => (
              <option value={size} key={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <nav
          aria-label="Resource pagination"
          className="flex items-center gap-1"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="First page"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span
            aria-live="polite"
            className="text-muted-foreground min-w-24 text-center text-xs tabular-nums"
          >
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Last page"
            disabled={page >= pages}
            onClick={() => onPageChange(pages)}
          >
            <ChevronsRight aria-hidden />
          </Button>
        </nav>
      </div>
    </div>
  );
}
