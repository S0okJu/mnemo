import type { DeploymentResource } from "@/lib/resource-registry/kinds/deployment";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const deployments: DeploymentResource[] = [
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-api",
      namespace: "mnemo-system",
      uid: uid("deploy"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api", tier: "backend", team: "platform" },
    },
    spec: {
      replicas: 3,
      strategy: "RollingUpdate",
      image: "ghcr.io/mnemo/api:1.8.2",
    },
    status: { level: "Healthy", readyReplicas: 3, availableReplicas: 3 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-web",
      namespace: "mnemo-system",
      uid: uid("deploy"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-web", tier: "frontend", team: "platform" },
    },
    spec: {
      replicas: 2,
      strategy: "RollingUpdate",
      image: "ghcr.io/mnemo/web:1.8.2",
    },
    status: { level: "Healthy", readyReplicas: 2, availableReplicas: 2 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "ingress-nginx-controller",
      namespace: "ingress-nginx",
      uid: uid("deploy"),
      createdAt: daysAgo(120),
      labels: {
        app: "ingress-nginx",
        "app.kubernetes.io/component": "controller",
      },
    },
    spec: {
      replicas: 2,
      strategy: "RollingUpdate",
      image: "registry.k8s.io/ingress-nginx/controller:v1.11.3",
    },
    status: { level: "Healthy", readyReplicas: 2, availableReplicas: 2 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "rook-ceph-operator",
      namespace: "rook-ceph",
      uid: uid("deploy"),
      createdAt: daysAgo(96),
      labels: { app: "rook-ceph-operator" },
    },
    spec: { replicas: 1, strategy: "Recreate", image: "rook/ceph:v1.15.3" },
    status: { level: "Healthy", readyReplicas: 1, availableReplicas: 1 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "payments-worker",
      namespace: "default",
      uid: uid("deploy"),
      createdAt: daysAgo(12),
      labels: { app: "payments-worker", tier: "backend" },
    },
    spec: {
      replicas: 4,
      strategy: "RollingUpdate",
      image: "ghcr.io/acme/payments-worker:2.3.0",
    },
    status: {
      level: "Progressing",
      readyReplicas: 3,
      availableReplicas: 3,
      message: "Rolling out revision 2.3.0",
    },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "notification-service",
      namespace: "default",
      uid: uid("deploy"),
      createdAt: daysAgo(30),
      labels: { app: "notification-service", tier: "backend" },
    },
    spec: {
      replicas: 2,
      strategy: "RollingUpdate",
      image: "ghcr.io/acme/notification-service:4.1.1",
    },
    status: {
      level: "Warning",
      readyReplicas: 1,
      availableReplicas: 1,
      message: "1/2 replicas ready, image pull backoff on node-3",
    },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "legacy-batch-job-runner",
      namespace: "default",
      uid: uid("deploy"),
      createdAt: daysAgo(210),
      labels: { app: "legacy-batch-job-runner", deprecated: "true" },
    },
    spec: {
      replicas: 1,
      strategy: "Recreate",
      image: "internal/legacy-runner:0.9.4",
    },
    status: {
      level: "Error",
      readyReplicas: 0,
      availableReplicas: 0,
      message: "CrashLoopBackOff: exit code 1",
    },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "metrics-server",
      namespace: "kube-system",
      uid: uid("deploy"),
      createdAt: daysAgo(150),
      labels: { "k8s-app": "metrics-server" },
    },
    spec: {
      replicas: 1,
      strategy: "RollingUpdate",
      image: "registry.k8s.io/metrics-server/metrics-server:v0.7.2",
    },
    status: { level: "Healthy", readyReplicas: 1, availableReplicas: 1 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "cert-manager",
      namespace: "cert-manager",
      uid: uid("deploy"),
      createdAt: daysAgo(180),
      labels: {
        app: "cert-manager",
        "app.kubernetes.io/component": "controller",
      },
    },
    spec: {
      replicas: 1,
      strategy: "RollingUpdate",
      image: "quay.io/jetstack/cert-manager-controller:v1.16.1",
    },
    status: { level: "Healthy", readyReplicas: 1, availableReplicas: 1 },
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    metadata: {
      name: "search-indexer",
      namespace: "default",
      uid: uid("deploy"),
      createdAt: hoursAgo(6),
      labels: { app: "search-indexer", tier: "backend" },
    },
    spec: {
      replicas: 2,
      strategy: "RollingUpdate",
      image: "ghcr.io/acme/search-indexer:0.4.0",
    },
    status: {
      level: "Unknown",
      readyReplicas: 0,
      availableReplicas: 0,
      message: "Awaiting first health check",
    },
  },
];
