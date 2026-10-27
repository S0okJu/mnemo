"use client";

import { useEffect, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LocalMenu } from "./LocalMenu";
import { componentNavigation, componentMenu } from "../registry/navigation";
import { BreadcrumbHeader, type BreadcrumbSegment } from "./BreadcrumbHeader";
import { EmptyState } from "./EmptyState";
import { SubsystemOverview } from "./SubsystemOverview";
import { ResourceListView } from "./ResourceListView";
import { ResourceReturnContext } from "./ResourceNavigation";
import { AutoRefreshProvider, useAutoRefresh } from "./AutoUpdateIndicator";
import { useUrlState } from "@/features/resource-explorer/hooks/useUrlState";
import { readListState } from "@/features/resource-explorer/lib/list-state";
import { getResourceType } from "@/lib/resource-registry/registry";
import { resourceKeys } from "@/lib/query/queryKeys";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";
import type { SubsystemKind } from "@/features/resource-explorer/types";
export type { SubsystemKind } from "@/features/resource-explorer/types";

const SCROLL_KEY = "mnemo.scroll:";

/** Restore a list's scroll position after returning from a detail page. */
function useScrollRestore(key: string, ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  const restored = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !ready || restored.current) return;
    restored.current = true;
    try {
      const saved = Number(sessionStorage.getItem(SCROLL_KEY + key));
      if (saved > 0) element.scrollTop = saved;
    } catch {
      // Storage may be unavailable; scrolling from the top is fine.
    }
  }, [key, ready]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(SCROLL_KEY + key, String(element.scrollTop));
        } catch {
          // Ignore storage failures.
        }
      });
    };
    element.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", save);
    };
  }, [key]);
  return ref;
}

function EnabledSubsystem({ kinds }: { kinds: SubsystemKind[] }) {
  const { searchParams, href, pathname } = useUrlState();
  const component = componentNavigation.find(
    (entry) => entry.basePath === pathname,
  );
  const state = readListState(
    new URLSearchParams(searchParams.toString()),
    kinds.map(({ kind }) => kind),
  );
  const paused = useAutoRefresh()?.paused ?? false;
  const results = useQueries({
    queries: kinds.map(({ kind }) => {
      const type = getResourceType(kind);
      return {
        queryKey: resourceKeys.list(kind, {}),
        queryFn: () => type.fetchList({}),
        refetchInterval: paused ? (false as const) : type.pollingIntervalMs,
        retry: false,
      };
    }),
  });
  const scrollRef = useScrollRestore(
    href,
    results.every((result) => !result.isLoading),
  );
  return (
    <ResourceReturnContext.Provider value={href}>
      {kinds.length > 1 ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <LocalMenu
            label="Component features"
            selected={
              state.view === "overview"
                ? "overview"
                : state.type === "all"
                  ? kinds[0].kind
                  : state.type
            }
            items={
              component
                ? componentMenu(component)
                : [
                    { id: "overview", label: "Overview", href: pathname },
                    ...kinds.map(({ kind }) => ({
                      id: kind,
                      label: getResourceType(kind).label,
                      href: `${pathname}?type=${encodeURIComponent(kind)}&view=resources`,
                    })),
                  ]
            }
          />
          <main ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
            {state.view === "overview" ? (
              <SubsystemOverview kinds={kinds} results={results} />
            ) : (
              <ResourceListView
                kinds={kinds.filter(
                  ({ kind }) =>
                    kind ===
                    (state.type === "all" ? kinds[0].kind : state.type),
                )}
                results={results.filter(
                  (_, index) =>
                    kinds[index].kind ===
                    (state.type === "all" ? kinds[0].kind : state.type),
                )}
              />
            )}
          </main>
        </div>
      ) : (
        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <ResourceListView kinds={kinds} results={results} />
        </main>
      )}
    </ResourceReturnContext.Provider>
  );
}
export function SubsystemPage({
  breadcrumb,
  subsystemId,
  kinds,
  showHeader = true,
}: {
  breadcrumb: BreadcrumbSegment[];
  subsystemId: string;
  kinds: SubsystemKind[];
  showHeader?: boolean;
}) {
  const { isEnabled } = useIntegrations();
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showHeader && (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <BreadcrumbHeader segments={breadcrumb} />
        </div>
      )}
      {!isEnabled(subsystemId) ? (
        <EmptyState
          icon={Inbox}
          title="This integration is disabled"
          description="Turn it on from the Integrations page to see its resources here."
        />
      ) : kinds.length ? (
        <AutoRefreshProvider>
          <EnabledSubsystem kinds={kinds} />
        </AutoRefreshProvider>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No resource types"
          description="No resource types are available in this section."
        />
      )}
    </div>
  );
}
