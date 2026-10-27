"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  children,
  className,
}: {
  value: string;
  label: string;
  children?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }
  const feedback =
    state === "copied"
      ? "Copied"
      : state === "failed"
        ? "Unable to copy. Select the text to copy it manually."
        : label;
  const icon =
    state === "copied" ? (
      <Check aria-hidden className="text-status-healthy" />
    ) : (
      <Copy aria-hidden />
    );
  if (children)
    return (
      <Button variant="outline" size="sm" onClick={copy} className={className}>
        {icon}
        <span aria-live="polite">
          {state === "copied" ? "Copied" : children}
        </span>
      </Button>
    );
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={copy}
            className={cn("text-muted-foreground", className)}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{feedback}</TooltipContent>
    </Tooltip>
  );
}
