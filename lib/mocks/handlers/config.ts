import { rbacServiceAccounts } from "@/lib/mocks/fixtures/rbac";
import { pods } from "@/lib/mocks/fixtures/pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import { configmaps } from "@/lib/mocks/fixtures/configmaps";
import { secrets } from "@/lib/mocks/fixtures/secrets";
import type { ConfigMapResource } from "@/lib/resource-registry/kinds/configmap";
import type { SecretResource } from "@/lib/resource-registry/kinds/secret";

// Keep ServiceAccount secret references navigable in the mock environment.
for (const account of rbacServiceAccounts) {
  for (const name of account.spec?.secrets ?? []) {
    if (
      !secrets.some(
        (secret) =>
          secret.metadata.name === name &&
          secret.metadata.namespace === account.metadata.namespace,
      )
    ) {
      secrets.push({
        kind: "Secret",
        apiVersion: "v1",
        metadata: {
          ...account.metadata,
          name,
          uid: `secret-${account.metadata.namespace}-${name}`,
        },
        spec: {
          type: "kubernetes.io/service-account-token",
          keys: ["token", "ca.crt", "namespace"],
        },
        status: { level: "Healthy" },
      });
    }
  }
}

export const configMapHandlers = createResourceHandlers<ConfigMapResource>({
  kindPath: "configmaps",
  items: configmaps,
  subContent: (resource) =>
    pods
      .filter(
        (pod) =>
          pod.metadata.namespace === resource.metadata.namespace &&
          !!resource.metadata.labels?.app &&
          pod.metadata.labels?.app === resource.metadata.labels.app,
      )
      .map((pod) => pod.metadata.name),
});

export const secretHandlers = createResourceHandlers<SecretResource>({
  kindPath: "secrets",
  items: secrets,
  subContent: (resource) =>
    pods
      .filter(
        (pod) =>
          pod.metadata.namespace === resource.metadata.namespace &&
          !!resource.metadata.labels?.app &&
          pod.metadata.labels?.app === resource.metadata.labels.app,
      )
      .map((pod) => pod.metadata.name),
});
