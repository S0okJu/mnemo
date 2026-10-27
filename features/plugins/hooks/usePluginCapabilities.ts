"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";

export interface PluginCapabilities {
  installed: boolean;
  version?: string;
  source: "mock" | "cluster";
  resources: { kind: string; available: boolean; permitted: boolean }[];
}
export function usePluginCapabilities(pluginId: string) {
  const { isEnabled } = useIntegrations();
  return useQuery({
    queryKey: ["plugins", pluginId, "capabilities"],
    queryFn: () =>
      apiFetch<PluginCapabilities>(`/integrations/${pluginId}/capabilities`),
    enabled: isEnabled(pluginId),
    refetchInterval: 30000,
    retry: false,
  });
}
