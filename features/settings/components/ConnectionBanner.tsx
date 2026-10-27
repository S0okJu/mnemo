"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClusterConnection } from "../hooks/useClusterConnection";

const MESSAGES = {
  "not-configured": {
    text: "No cluster connected.",
    action: "Connect a cluster",
  },
  unreachable: {
    text: "The cluster is unreachable.",
    action: "Check settings",
  },
  unauthorized: {
    text: "The cluster rejected the stored credentials.",
    action: "Check settings",
  },
};

/** Persistent notice on dashboard pages while there is no usable connection. */
export function ConnectionBanner() {
  const pathname = usePathname();
  const { data } = useClusterConnection();
  if (!data || data.status === "connected" || pathname.startsWith("/settings"))
    return null;
  const message = MESSAGES[data.status];
  const missing = data.status === "not-configured";
  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm",
        missing
          ? "bg-muted/60"
          : "bg-status-error/10 text-status-error border-status-error/20",
      )}
    >
      {missing ? (
        <PlugZap aria-hidden className="size-4 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
      )}
      <span>{message.text}</span>
      <Link
        href="/settings"
        className="font-medium underline-offset-4 hover:underline"
      >
        {message.action} →
      </Link>
    </div>
  );
}
