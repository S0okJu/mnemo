import type { ConfigMapResource } from "@/lib/resource-registry/kinds/configmap";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const configmaps: ConfigMapResource[] = [
  {
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api-config",
      namespace: "mnemo-system",
      uid: uid("cm"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: { keys: ["LOG_LEVEL", "FEATURE_FLAGS", "RATE_LIMIT"] },
    status: { level: "Healthy" },
  },
  {
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
      name: "nginx-config",
      namespace: "ingress-nginx",
      uid: uid("cm"),
      createdAt: daysAgo(120),
      labels: { app: "ingress-nginx" },
    },
    spec: { keys: ["nginx.conf", "mime.types"] },
    status: { level: "Healthy" },
  },
  {
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
      name: "kube-root-ca.crt",
      namespace: "default",
      uid: uid("cm"),
      createdAt: daysAgo(365),
      labels: {},
    },
    spec: { keys: ["ca.crt"] },
    status: { level: "Healthy" },
  },
  {
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
      name: "search-indexer-config",
      namespace: "default",
      uid: uid("cm"),
      createdAt: hoursAgo(6),
      labels: { app: "search-indexer" },
    },
    spec: { keys: ["INDEX_BATCH_SIZE", "ELASTICSEARCH_URL"] },
    status: { level: "Unknown" },
  },
];
