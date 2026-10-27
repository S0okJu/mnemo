import { Route } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { EmptyState } from "@/features/resource-explorer/components/EmptyState";
import { BreadcrumbHeader } from "@/features/resource-explorer/components/BreadcrumbHeader";

export default function TraefikPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <BreadcrumbHeader
          segments={[{ label: "Network" }, { label: "Traefik" }]}
        />
      </div>
      <EmptyState
        icon={Route}
        title="Traefik integration coming soon"
        description="IngressRoute, Middleware, and other Traefik CRDs will plug into this section via the resource registry."
      />
    </div>
  );
}
