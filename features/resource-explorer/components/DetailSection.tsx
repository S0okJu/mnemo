import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

export function DetailSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <SectionHeader title={title} count={count} action={action} />
      {children}
    </section>
  );
}
