"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { ResizeHandle } from "./ResizeHandle";

const WIDTH = { min: 160, max: 360, default: 208 };

export interface LocalMenuItem {
  id: string;
  label: string;
  href: string;
  /** Non-interactive heading shared by consecutive items. */
  group?: string;
  /** Reason the destination cannot be opened; renders the item disabled. */
  disabled?: string;
}

export function LocalMenu({
  label,
  items,
  selected,
}: {
  label: string;
  items: LocalMenuItem[];
  selected: string;
}) {
  const [open, setOpen] = useState(false);
  const navId = useId();
  const navRef = useRef<HTMLElement>(null);
  // One width shared by every component so the layout stays put between pages.
  const [width, setWidth] = useLocalStorageState(
    "mnemo.local-menu.width",
    WIDTH.default,
  );
  function entry(item: LocalMenuItem) {
    const active = selected === item.id;
    if (item.disabled)
      return (
        <span
          aria-disabled
          title={`${item.label} — ${item.disabled}`}
          className="text-muted-foreground/50 block cursor-not-allowed truncate rounded-md px-3 py-1.5 text-sm"
        >
          {item.label}
        </span>
      );
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        title={item.label}
        className={cn(
          "focus-visible:ring-sidebar-ring relative block truncate rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground before:bg-sidebar-primary font-medium before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {item.label}
      </Link>
    );
  }
  function links(prefix: string) {
    const sections: { group?: string; items: LocalMenuItem[] }[] = [];
    for (const item of items) {
      const last = sections.at(-1);
      if (last && last.group === item.group) last.items.push(item);
      else sections.push({ group: item.group, items: [item] });
    }
    return sections.map((section, index) => {
      const headingId = `${prefix}-${index}`;
      const unavailable = section.items.every((item) => item.disabled);
      return (
        <div key={headingId} className={cn(section.group && "pt-3")}>
          {section.group && (
            <p
              id={headingId}
              className="text-muted-foreground/80 flex items-center justify-between gap-2 px-3 pb-1 text-[11px] font-medium tracking-wide uppercase"
            >
              <span className="truncate">{section.group}</span>
              {unavailable && (
                <span className="font-normal tracking-normal normal-case">
                  Not installed
                </span>
              )}
            </p>
          )}
          {!(section.group && unavailable) && (
            <ul
              aria-labelledby={section.group ? headingId : undefined}
              className="space-y-0.5"
            >
              {section.items.map((item) => (
                <li key={item.id}>{entry(item)}</li>
              ))}
            </ul>
          )}
        </div>
      );
    });
  }
  return (
    <>
      <div className="relative hidden shrink-0 lg:block">
        <nav
          id={navId}
          ref={navRef}
          aria-label={label}
          style={{ width }}
          className="bg-sidebar h-full space-y-0.5 overflow-y-auto border-r p-2"
        >
          {links(`${navId}-desktop`)}
        </nav>
        <ResizeHandle
          label={`Resize ${label.toLowerCase()}`}
          controls={navId}
          value={width}
          min={WIDTH.min}
          max={WIDTH.max}
          defaultValue={WIDTH.default}
          onCommit={setWidth}
          onLive={(next) => {
            if (navRef.current) navRef.current.style.width = `${next}px`;
          }}
        />
      </div>
      <div className="border-b px-4 py-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" className="max-w-full" />}
          >
            <Menu aria-hidden className="size-4" />
            <span className="truncate">
              {items.find((item) => item.id === selected)?.label ?? label}
            </span>
            <span className="sr-only"> — {label}</span>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <nav aria-label={label} className="space-y-0.5 overflow-y-auto p-2">
              {links(`${navId}-drawer`)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
