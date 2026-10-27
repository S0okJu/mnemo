import type { ReactNode } from "react";
import { PluginShell } from "@/features/plugins/components/PluginShell";
export default function KubeOvnLayout({ children }: { children: ReactNode }) {
  return <PluginShell>{children}</PluginShell>;
}
