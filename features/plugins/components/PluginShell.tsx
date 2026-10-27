"use client";

import Link from "next/link";
import { LocalMenu } from "@/features/resource-explorer/components/LocalMenu";
import { ResourceReturnContext } from "@/features/resource-explorer/components/ResourceNavigation";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Cable, AlertCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/features/resource-explorer/components/EmptyState";
import { BreadcrumbHeader } from "@/features/resource-explorer/components/BreadcrumbHeader";
import {
  kubeOvnMenu,
  kubeOvnPlugin,
} from "@/features/plugins/registry/kube-ovn";
import { usePluginCapabilities } from "@/features/plugins/hooks/usePluginCapabilities";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";

export function PluginShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isEnabled } = useIntegrations();
  const capabilities = usePluginCapabilities(kubeOvnPlugin.id);
  const enabled = isEnabled(kubeOvnPlugin.id);
  const routeParts = pathname.split("/");
  const resourceKind = kubeOvnPlugin.resources.find(
    (resource) => resource.slug === routeParts[4],
  )?.kind;
  const selected = routeParts[3] === "resources" ? resourceKind : "overview";
  // Detail pages draw their own header with the full breadcrumb.
  const isDetail = routeParts[3] === "resources" && routeParts.length > 5;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={
          isDetail
            ? "hidden"
            : "flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3"
        }
      >
        <SidebarTrigger />
        <BreadcrumbHeader
          segments={[
            { label: "CNI" },
            { label: "Kube-OVN", href: kubeOvnPlugin.basePath },
          ]}
        />
        {capabilities.data?.version && (
          <Badge variant="outline" className="ml-auto font-normal">
            {capabilities.data.version}
          </Badge>
        )}
        {capabilities.data?.source === "mock" && (
          <Badge variant="secondary">Demo data</Badge>
        )}
      </div>
      {!enabled ? (
        <div className="p-6">
          <EmptyState
            icon={Cable}
            title="Kube-OVN plugin is disabled"
            description="Enable it in Integrations to explore Kube-OVN resources."
          />
          <Link
            className="text-primary block text-center text-sm underline"
            href="/integrations"
          >
            Open Integrations
          </Link>
        </div>
      ) : capabilities.isPending ? (
        <div role="status" className="space-y-3 p-6">
          <span className="sr-only">Detecting Kube-OVN</span>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : capabilities.isError ? (
        <div className="p-6">
          <EmptyState
            icon={AlertCircle}
            title="Unable to detect Kube-OVN"
            description="Check the cluster connection and access permissions, then try again."
          />
          <div className="text-center">
            <Button variant="outline" onClick={() => capabilities.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      ) : !capabilities.data?.installed ? (
        <EmptyState
          icon={Cable}
          title="Kube-OVN is not installed"
          description="This plugin is enabled, but Kube-OVN was not detected in this cluster. Install it in the cluster to use these views."
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <LocalMenu
            label="Kube-OVN resources"
            selected={selected ?? "overview"}
            items={kubeOvnMenu(capabilities.data.resources)}
          />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <ResourceReturnContext.Provider value={pathname}>
              {children}
            </ResourceReturnContext.Provider>
          </main>
        </div>
      )}
    </div>
  );
}
