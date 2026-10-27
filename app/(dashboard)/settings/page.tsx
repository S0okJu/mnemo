import { SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbHeader } from "@/features/resource-explorer/components/BreadcrumbHeader";
import { PageHeader } from "@/features/resource-explorer/components/PageHeader";
import { ClusterSettings } from "@/features/settings/components/ClusterSettings";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <BreadcrumbHeader segments={[{ label: "Settings" }]} />
      </div>
      <div className="w-full max-w-4xl flex-1 space-y-8 px-4 py-6 sm:px-6">
        <PageHeader
          title="Settings"
          description="Choose the cluster this dashboard reads from."
        />
        <ClusterSettings />
      </div>
    </div>
  );
}
