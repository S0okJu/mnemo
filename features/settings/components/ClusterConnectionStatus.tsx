"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ClusterConnection } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/utils/format";
import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import {
  StatusDot,
  statusTone,
} from "@/features/resource-explorer/components/StatusBadge";
import { AUTH_LABELS } from "../lib/kubeconfig";
import { useClusterConnectionActions } from "../hooks/useClusterConnection";

const STATUS: Record<
  ClusterConnection["status"],
  { label: string; level: "Healthy" | "Error" | "Unknown" }
> = {
  connected: { label: "Connected", level: "Healthy" },
  unreachable: { label: "Unreachable", level: "Error" },
  unauthorized: { label: "Credentials rejected", level: "Error" },
  "not-configured": { label: "Not configured", level: "Unknown" },
};

export function ConnectionBadge({
  status,
}: {
  status: ClusterConnection["status"];
}) {
  const { label, level } = STATUS[status];
  const tone = statusTone(level);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        tone.text,
        tone.subtle,
        tone.border,
      )}
    >
      <StatusDot level={level} />
      {label}
    </span>
  );
}

export function ClusterConnectionStatus({
  connection,
  onReplace,
  replacing,
  canEdit,
}: {
  connection: ClusterConnection;
  onReplace: () => void;
  replacing: boolean;
  canEdit: boolean;
}) {
  const { test, disconnect } = useClusterConnectionActions();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConnectionBadge status={connection.status} />
        {connection.source === "mock" && (
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
            Demo data
          </span>
        )}
        {connection.source === "in-cluster" && (
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
            In-cluster service account
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              <RefreshCw
                aria-hidden
                className={cn(test.isPending && "animate-spin")}
              />
              Test connection
            </Button>
          )}
          {canEdit && connection.source !== "in-cluster" && !replacing && (
            <Button variant="outline" size="sm" onClick={onReplace}>
              Replace kubeconfig
            </Button>
          )}
          {canEdit &&
            connection.source !== "in-cluster" &&
            (confirming ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    disconnect.mutate(undefined, {
                      onSettled: () => setConfirming(false),
                    })
                  }
                  disabled={disconnect.isPending}
                >
                  Confirm disconnect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                Disconnect
              </Button>
            ))}
        </div>
      </div>
      {connection.message && connection.status !== "connected" && (
        <p role="alert" className="text-destructive text-sm">
          {connection.message}
        </p>
      )}
      {test.isError && (
        <p role="alert" className="text-destructive text-sm">
          The connection test could not be run. Try again.
        </p>
      )}
      <PropertyList
        items={[
          { label: "Context", value: connection.context },
          { label: "Cluster", value: connection.cluster },
          {
            label: "Server",
            value: connection.server,
            mono: true,
            copy: connection.server,
            wide: true,
          },
          { label: "User", value: connection.user },
          {
            label: "Authentication",
            value: connection.authType && AUTH_LABELS[connection.authType],
          },
          { label: "Default namespace", value: connection.namespace },
          { label: "Kubernetes version", value: connection.version },
          {
            label: "Last checked",
            value: connection.checkedAt && (
              <time
                dateTime={connection.checkedAt}
                title={new Date(connection.checkedAt).toLocaleString()}
              >
                {formatAge(connection.checkedAt)} ago
              </time>
            ),
          },
        ]}
      />
    </div>
  );
}
