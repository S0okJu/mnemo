import { HardDrive } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { EmptyState } from "@/features/resource-explorer/components/EmptyState";
import { BreadcrumbHeader } from "@/features/resource-explorer/components/BreadcrumbHeader";

export default function RookCephOverviewPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <BreadcrumbHeader
          segments={[{ label: "Storage" }, { label: "Rook-Ceph" }]}
        />
      </div>
      <EmptyState
        icon={HardDrive}
        title="Rook-Ceph integration coming soon"
        description="CephCluster, CephBlockPool, and other Rook CRDs will plug into this section via the resource registry."
      />
    </div>
  );
}
