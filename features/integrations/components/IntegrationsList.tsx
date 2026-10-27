"use client";

import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useIntegrations } from "@/features/integrations/hooks/useIntegrations";
import { integrations } from "@/features/integrations/registry/integrations";
import { categories } from "@/features/categories/registry/categories";
import { SectionHeader } from "@/features/resource-explorer/components/SectionHeader";

export function IntegrationsList() {
  const { isEnabled, toggle } = useIntegrations();

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const CategoryIcon = category.icon;
        const categoryIntegrations = integrations.filter(
          (integration) => integration.categoryId === category.id,
        );

        return (
          <section key={category.id} className="space-y-3">
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  <CategoryIcon
                    aria-hidden
                    className="text-muted-foreground size-4"
                  />
                  {category.label}
                </span>
              }
              count={
                categoryIntegrations.filter((integration) =>
                  isEnabled(integration.id),
                ).length
              }
              caption={`of ${categoryIntegrations.length} enabled`}
            />

            <ul className="grid gap-3 sm:grid-cols-2">
              {categoryIntegrations.map((integration) => {
                const Icon = integration.icon;
                const enabled = isEnabled(integration.id);

                return (
                  <li
                    key={integration.id}
                    className="flex items-start gap-3 rounded-lg border p-4"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md transition-colors ${enabled ? "bg-count-subtle text-count" : "bg-muted text-muted-foreground"}`}
                    >
                      <Icon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {integration.name}
                        </p>
                        {integration.core && (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground gap-1 font-normal"
                          >
                            <Lock className="size-3" />
                            Core
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {integration.description}
                      </p>
                    </div>

                    {integration.core ? (
                      <Switch
                        checked
                        disabled
                        aria-label={`${integration.name} is always enabled`}
                      />
                    ) : (
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggle(integration.id)}
                        aria-label={`Toggle ${integration.name}`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
