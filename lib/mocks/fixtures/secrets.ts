import type { SecretResource } from "@/lib/resource-registry/kinds/secret";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const secrets: SecretResource[] = [
  {
    kind: "Secret",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-postgres-credentials",
      namespace: "mnemo-system",
      uid: uid("secret"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: { type: "Opaque", keys: ["username", "password"] },
    status: { level: "Healthy" },
  },
  {
    kind: "Secret",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api-token-x7k2p",
      namespace: "mnemo-system",
      uid: uid("secret"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: {
      type: "kubernetes.io/service-account-token",
      keys: ["token", "ca.crt", "namespace"],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Secret",
    apiVersion: "v1",
    metadata: {
      name: "ingress-tls-cert",
      namespace: "ingress-nginx",
      uid: uid("secret"),
      createdAt: daysAgo(80),
      labels: { app: "ingress-nginx" },
    },
    spec: { type: "kubernetes.io/tls", keys: ["tls.crt", "tls.key"] },
    status: { level: "Warning", message: "Certificate expiring in 3 days" },
  },
  {
    kind: "Secret",
    apiVersion: "v1",
    metadata: {
      name: "ci-deployer-token",
      namespace: "mnemo-system",
      uid: uid("secret"),
      createdAt: hoursAgo(5),
      labels: { app: "ci-deployer" },
    },
    spec: { type: "Opaque", keys: ["deploy-key"] },
    status: { level: "Healthy" },
  },
];
