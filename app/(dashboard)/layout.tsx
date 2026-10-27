import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SIDEBAR_WIDTH_PX } from "@/components/ui/sidebar-width";
import { AppSidebar } from "@/features/nav/components/AppSidebar";
import { IntegrationsProvider } from "@/features/integrations/hooks/useIntegrations";
import { ConnectionBanner } from "@/features/settings/components/ConnectionBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const storedWidth = Number(cookieStore.get("sidebar_width")?.value);
  const defaultWidth = Number.isFinite(storedWidth)
    ? Math.min(
        SIDEBAR_WIDTH_PX.max,
        Math.max(SIDEBAR_WIDTH_PX.min, storedWidth),
      )
    : SIDEBAR_WIDTH_PX.default;

  return (
    <IntegrationsProvider>
      <SidebarProvider defaultOpen={defaultOpen} defaultWidth={defaultWidth}>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <ConnectionBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </IntegrationsProvider>
  );
}
