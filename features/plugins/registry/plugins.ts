import type { PluginDefinition } from "@/features/plugins/types";
import { kubeOvnPlugin } from "./kube-ovn";

export const plugins: PluginDefinition[] = [kubeOvnPlugin];
export const pluginResourceDefinitions = plugins.flatMap((plugin) =>
  plugin.resources.map((resource) => ({
    ...resource,
    pluginId: plugin.id,
    basePath: plugin.basePath,
  })),
);
