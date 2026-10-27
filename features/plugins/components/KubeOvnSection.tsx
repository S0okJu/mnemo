"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { kubeOvnAvailability } from "@/features/plugins/registry/kube-ovn";
import { usePluginCapabilities } from "@/features/plugins/hooks/usePluginCapabilities";
import { EmptyState } from "@/features/resource-explorer/components/EmptyState";

export function KubeOvnResourceGate({
  kind,
  children,
}: {
  kind: string;
  children: ReactNode;
}) {
  const capabilities = usePluginCapabilities("kube-ovn");
  const reason = kubeOvnAvailability(kind, capabilities.data?.resources ?? []);
  return reason ? (
    <EmptyState
      icon={ShieldAlert}
      title="Resource unavailable"
      description={reason}
    />
  ) : (
    children
  );
}
