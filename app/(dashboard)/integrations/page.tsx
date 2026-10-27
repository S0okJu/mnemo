import { SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbHeader } from "@/features/resource-explorer/components/BreadcrumbHeader";
import { IntegrationsList } from "@/features/integrations/components/IntegrationsList";
import { PageHeader } from "@/features/resource-explorer/components/PageHeader";

export default function IntegrationsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <BreadcrumbHeader segments={[{ label: "Integrations" }]} />
      </div>

      <div className="w-full max-w-4xl flex-1 space-y-8 px-4 py-6 sm:px-6">
        <PageHeader
          title="Integrations"
          description="Core Kubernetes resources are always available. Turn optional CNCF tool integrations on or off to keep the navigation focused on what you use."
        />
        <IntegrationsList />
      </div>
    </div>
  );
}
