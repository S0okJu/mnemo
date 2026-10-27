"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { integrations } from "@/features/integrations/registry/integrations";

const STORAGE_KEY = "mnemo.enabled-integrations";

const defaultEnabled = integrations.filter((i) => !i.core).map((i) => i.id);

interface IntegrationsContextValue {
  isEnabled: (id: string) => boolean;
  toggle: (id: string) => void;
}

const IntegrationsContext = createContext<IntegrationsContextValue | null>(
  null,
);

export function IntegrationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [storedIds, setEnabledIds] = useLocalStorageState<string[]>(
    STORAGE_KEY,
    defaultEnabled,
  );

  // Preserve the old CNI toggle when migrating to the provider-specific plugin.
  const enabledIds = useMemo(
    () => storedIds.map((id) => (id === "cni" ? "kube-ovn" : id)),
    [storedIds],
  );

  const isEnabled = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id);
      if (!integration) return false;
      return integration.core || enabledIds.includes(id);
    },
    [enabledIds],
  );

  const toggle = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id);
      if (!integration || integration.core) return;
      setEnabledIds((stored) => {
        const prev = stored.map((item) => (item === "cni" ? "kube-ovn" : item));
        return prev.includes(id)
          ? prev.filter((item) => item !== id)
          : [...prev, id];
      });
    },
    [setEnabledIds],
  );

  const value = useMemo(() => ({ isEnabled, toggle }), [isEnabled, toggle]);

  return (
    <IntegrationsContext.Provider value={value}>
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations() {
  const ctx = useContext(IntegrationsContext);
  if (!ctx) {
    throw new Error("useIntegrations must be used within IntegrationsProvider");
  }
  return ctx;
}
