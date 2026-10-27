"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/features/resource-explorer/components/SectionHeader";
import { useClusterConnection } from "../hooks/useClusterConnection";
import {
  ClusterConnectionStatus,
  ConnectionBadge,
} from "./ClusterConnectionStatus";
import { KubeconfigForm } from "./KubeconfigForm";
import { useSession } from "../hooks/useSession";

export function ClusterSettings() {
  const connection = useClusterConnection();
  const session = useSession();
  const canEdit = session.data?.admin === true;
  const [replacing, setReplacing] = useState(false);
  const [saved, setSaved] = useState<string>();
  const configured = connection.data?.configured ?? false;
  return (
    <section aria-label="Cluster connection" className="space-y-4">
      <SectionHeader title="Cluster connection" />
      {connection.isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading cluster connection</span>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : connection.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">
            The connection status could not be loaded.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => connection.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {saved && configured && (
            <p
              role="status"
              className="text-status-healthy flex items-center gap-2 text-sm"
            >
              <CheckCircle2 aria-hidden className="size-4" />
              Connected to {saved}. Dashboard data now comes from this cluster.
            </p>
          )}
          {configured && connection.data && (
            <ClusterConnectionStatus
              connection={connection.data}
              canEdit={canEdit}
              replacing={replacing}
              onReplace={() => {
                setSaved(undefined);
                setReplacing(true);
              }}
            />
          )}
          {!configured && <ConnectionBadge status="not-configured" />}
          {canEdit && (!configured || replacing) && (
            <div className={configured ? "pt-4" : undefined}>
              <KubeconfigForm
                replacing={configured}
                onDone={(context) => {
                  setReplacing(false);
                  setSaved(context);
                }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
