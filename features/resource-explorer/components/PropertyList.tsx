import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ResourceReference } from "@/lib/resource-registry/resource-reference";
import { CopyButton } from "./CopyButton";
import { ReferenceValue } from "./ReferenceValue";

export interface Property {
  label: string;
  value?: ReactNode;
  /** Resources this property points to; rendered as links with their status. */
  reference?: ResourceReference | ResourceReference[];
  mono?: boolean;
  /** Plain-text value offered through a copy button. */
  copy?: string;
  wide?: boolean;
}

export function PropertyList({ items }: { items: Property[] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-6 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
      {items.map(({ label, value: plain, reference, mono, copy, wide }) => {
        const references = [reference ?? []]
          .flat()
          .filter((entry) => entry.name);
        const value = references.length ? (
          <ReferenceValue references={references} />
        ) : (
          plain
        );
        const missing =
          value === undefined ||
          value === null ||
          value === "" ||
          (reference !== undefined && references.length === 0);
        return (
          <div key={label} className={cn("min-w-0", wide && "col-span-full")}>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd
              className={cn(
                "group/property mt-1 flex min-w-0 items-center gap-1 text-sm",
                mono && "font-mono text-xs",
              )}
            >
              {missing ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="min-w-0 break-all">{value}</span>
              )}
              {copy && !missing && (
                <CopyButton
                  value={copy}
                  label={`Copy ${label.toLowerCase()}`}
                  className="-my-1 size-6 opacity-0 group-hover/property:opacity-100 focus-visible:opacity-100"
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
