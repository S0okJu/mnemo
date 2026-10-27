import type { ReplicaSetResource } from "@/lib/resource-registry/kinds/replicaset";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const replicasets: ReplicaSetResource[] = [
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-api-7f9c8d",
      namespace: "mnemo-system",
      uid: uid("rs"),
      createdAt: daysAgo(12),
      labels: { app: "mnemo-api" },
    },
    spec: {
      replicas: 3,
      image: "ghcr.io/mnemo/api:1.8.2",
      ownerDeployment: "mnemo-api",
    },
    status: { level: "Healthy", readyReplicas: 3 },
  },
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-web-6c9d7f",
      namespace: "mnemo-system",
      uid: uid("rs"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-web" },
    },
    spec: {
      replicas: 2,
      image: "ghcr.io/mnemo/web:1.8.2",
      ownerDeployment: "mnemo-web",
    },
    status: { level: "Healthy", readyReplicas: 2 },
  },
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "payments-worker-5d7f",
      namespace: "default",
      uid: uid("rs"),
      createdAt: hoursAgo(5),
      labels: { app: "payments-worker" },
    },
    spec: {
      replicas: 4,
      image: "ghcr.io/acme/payments-worker:2.3.0",
      ownerDeployment: "payments-worker",
    },
    status: { level: "Progressing", readyReplicas: 3 },
  },
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "notification-service-9c4b",
      namespace: "default",
      uid: uid("rs"),
      createdAt: daysAgo(1),
      labels: { app: "notification-service" },
    },
    spec: {
      replicas: 2,
      image: "ghcr.io/acme/notification-service:4.1.1",
      ownerDeployment: "notification-service",
    },
    status: { level: "Warning", readyReplicas: 1 },
  },
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-api-5a2b1c",
      namespace: "mnemo-system",
      uid: uid("rs"),
      createdAt: daysAgo(30),
      labels: { app: "mnemo-api" },
    },
    spec: {
      replicas: 0,
      image: "ghcr.io/mnemo/api:1.7.0",
      ownerDeployment: "mnemo-api",
    },
    status: {
      level: "Unknown",
      readyReplicas: 0,
      message: "Scaled down after rollout",
    },
  },
];
