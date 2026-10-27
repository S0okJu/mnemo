import type { IntegrationDefinition } from "@/features/integrations/registry/integrations";

export interface PluginFieldRef {
  kind: string;
  /** Path to the referenced resource's namespace, for namespaced targets. */
  namespacePath?: string;
}

export interface PluginResource {
  kind: string;
  label: string;
  slug: string;
  apiPath: string;
  scope: "Cluster" | "Namespaced";
  fields: { label: string; path: string; ref?: PluginFieldRef }[];
}

export interface PluginDefinition extends IntegrationDefinition {
  resources: PluginResource[];
  sections: {
    id: string;
    label: string;
    description: string;
    kinds: string[];
  }[];
}
