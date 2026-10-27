import { ownedPodNames } from "@/lib/mocks/fixtures/related-pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import { deployments } from "@/lib/mocks/fixtures/deployments";
import type { DeploymentResource } from "@/lib/resource-registry/kinds/deployment";

export const deploymentHandlers = createResourceHandlers<DeploymentResource>({
  kindPath: "deployments",
  items: deployments,
  subContent: (resource) => ({
    pods: ownedPodNames(resource, resource.status.readyReplicas),
    events: [
      {
        message: `Scaled up to ${resource.spec?.replicas} replicas`,
        time: "2h ago",
      },
      { message: "Image pulled successfully", time: "2h ago" },
      { message: "Readiness probe passed", time: "1h ago" },
    ],
  }),
});
