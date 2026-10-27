import type { PodResource } from "@/lib/resource-registry/kinds/pod";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const pods: PodResource[] = [
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api-7f9c8d-x2k9p",
      namespace: "mnemo-system",
      uid: uid("pod"),
      createdAt: daysAgo(12),
      labels: { app: "mnemo-api" },
    },
    spec: {
      image: "ghcr.io/mnemo/api:1.8.2",
      nodeName: "node-1",
      containerCount: 1,
    },
    status: { level: "Healthy", phase: "Running", restarts: 0 },
  },
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api-7f9c8d-q8j2n",
      namespace: "mnemo-system",
      uid: uid("pod"),
      createdAt: daysAgo(12),
      labels: { app: "mnemo-api" },
    },
    spec: {
      image: "ghcr.io/mnemo/api:1.8.2",
      nodeName: "node-2",
      containerCount: 1,
    },
    status: { level: "Healthy", phase: "Running", restarts: 0 },
  },
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "payments-worker-5d7f-2mz8x",
      namespace: "default",
      uid: uid("pod"),
      createdAt: hoursAgo(5),
      labels: { app: "payments-worker" },
    },
    spec: {
      image: "ghcr.io/acme/payments-worker:2.3.0",
      nodeName: "node-3",
      containerCount: 1,
    },
    status: { level: "Progressing", phase: "Pending", restarts: 0 },
  },
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "notification-service-9c4b-pk3w1",
      namespace: "default",
      uid: uid("pod"),
      createdAt: daysAgo(1),
      labels: { app: "notification-service" },
    },
    spec: {
      image: "ghcr.io/acme/notification-service:4.1.1",
      nodeName: "node-1",
      containerCount: 1,
    },
    status: { level: "Warning", phase: "Running", restarts: 6 },
  },
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "legacy-batch-job-runner-0",
      namespace: "default",
      uid: uid("pod"),
      createdAt: daysAgo(7),
      labels: { app: "legacy-batch-job-runner" },
    },
    spec: {
      image: "internal/legacy-runner:0.9.4",
      nodeName: "node-2",
      containerCount: 1,
    },
    status: { level: "Error", phase: "Failed", restarts: 14 },
  },
  {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: "search-indexer-6b8d-n7v4t",
      namespace: "default",
      uid: uid("pod"),
      createdAt: hoursAgo(6),
      labels: { app: "search-indexer" },
    },
    spec: {
      image: "ghcr.io/acme/search-indexer:0.4.0",
      nodeName: "node-3",
      containerCount: 1,
    },
    status: { level: "Unknown", phase: "Unknown", restarts: 0 },
  },
];
