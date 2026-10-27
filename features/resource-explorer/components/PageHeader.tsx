import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  as: Heading = "h1",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  children?: ReactNode;
}) {
  return (
    <header className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Heading className="min-w-0 text-2xl font-semibold tracking-tight break-all">
            {title}
          </Heading>
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {description && (
        <div className="text-muted-foreground text-sm">{description}</div>
      )}
    </header>
  );
}
