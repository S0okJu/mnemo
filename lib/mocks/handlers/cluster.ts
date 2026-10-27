import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import {
  nodes,
  namespaces,
  namespacedResources,
} from "@/lib/mocks/fixtures/cluster";
import { pods } from "@/lib/mocks/fixtures/pods";

export const nodeHandlers = createResourceHandlers({
  kindPath: "nodes",
  items: nodes,
  subContent: (resource) =>
    pods
      .filter((pod) => pod.spec?.nodeName === resource.metadata.name)
      .map((pod) => ({
        kind: "Pod",
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
      })),
});

const kindAliases: Record<string, string> = {
  RbacRole: "Role",
  RbacRoleBinding: "RoleBinding",
  RbacServiceAccount: "ServiceAccount",
};
export const namespaceHandlers = createResourceHandlers({
  kindPath: "namespaces",
  items: namespaces,
  subContent: (resource) =>
    namespacedResources()
      .filter((item) => item.metadata.namespace === resource.metadata.name)
      .map((item) => ({
        kind: kindAliases[item.kind] ?? item.kind,
        name: item.metadata.name,
        namespace: item.metadata.namespace,
      })),
});
