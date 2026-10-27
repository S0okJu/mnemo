"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Puzzle, Settings } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { categories } from "@/features/categories/registry/categories";
import { integrations } from "@/features/integrations/registry/integrations";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { useClusterConnection } from "@/features/settings/hooks/useClusterConnection";

function CategoryGroup({
  categoryId,
  label,
  subsystems,
  isActive,
}: {
  categoryId: string;
  label: string;
  subsystems: (typeof integrations)[number][];
  isActive: (basePath: string) => boolean;
}) {
  const { state, setOpenMobile } = useSidebar();
  const [storedOpen, setStoredOpen] = useLocalStorageState(
    `mnemo.sidebar-group.${categoryId}`,
    true,
  );
  const open = state === "collapsed" ? true : storedOpen;

  return (
    <Collapsible open={open} onOpenChange={setStoredOpen}>
      <SidebarGroup>
        <SidebarGroupLabel
          render={<CollapsibleTrigger />}
          className="cursor-pointer"
        >
          {label}
          <ChevronRight
            className={`ml-auto size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {subsystems.map((subsystem) => {
                const Icon = subsystem.icon;
                return (
                  <SidebarMenuItem key={subsystem.id}>
                    <SidebarMenuButton
                      isActive={isActive(subsystem.basePath)}
                      tooltip={subsystem.name}
                      render={
                        <Link
                          href={subsystem.basePath}
                          onNavigate={() => setOpenMobile(false)}
                          aria-current={
                            isActive(subsystem.basePath) ? "page" : undefined
                          }
                        />
                      }
                    >
                      <Icon />
                      <span>{subsystem.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { isEnabled } = useIntegrations();
  const connection = useClusterConnection();
  const clusterLabel = connection.data?.configured
    ? connection.data.context
    : connection.data
      ? "No cluster connected"
      : undefined;

  function isActive(basePath: string) {
    const active = integrations
      .filter(
        (integration) =>
          pathname === integration.basePath ||
          pathname.startsWith(`${integration.basePath}/`),
      )
      .sort((a, b) => b.basePath.length - a.basePath.length)[0];
    return active?.basePath === basePath;
  }

  const visibleSubsystemsByCategory = categories.map((category) => ({
    category,
    subsystems: integrations.filter(
      (i) => i.categoryId === category.id && isEnabled(i.id),
    ),
  }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={clusterLabel ? `mnemo · ${clusterLabel}` : "mnemo"}
              render={<Link href="/" onNavigate={() => setOpenMobile(false)} />}
            >
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold">
                m
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-sm font-semibold">mnemo</span>
                {clusterLabel && (
                  <span
                    title={clusterLabel}
                    aria-label={`Cluster: ${clusterLabel}`}
                    className="text-muted-foreground truncate text-xs"
                  >
                    {clusterLabel}
                  </span>
                )}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {visibleSubsystemsByCategory.map(({ category, subsystems }) => {
          if (subsystems.length === 0) return null;

          return (
            <CategoryGroup
              key={category.id}
              categoryId={category.id}
              label={category.label}
              subsystems={subsystems}
              isActive={isActive}
            />
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={pathname.startsWith("/settings")}
              render={
                <Link
                  href="/settings"
                  onNavigate={() => setOpenMobile(false)}
                />
              }
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Integrations"
              isActive={pathname.startsWith("/integrations")}
              render={
                <Link
                  href="/integrations"
                  onNavigate={() => setOpenMobile(false)}
                />
              }
            >
              <Puzzle />
              <span>Integrations</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
