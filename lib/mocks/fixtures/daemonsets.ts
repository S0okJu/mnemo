import type { DaemonSetResource } from "@/lib/resource-registry/kinds/daemonset";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const daemonsets: DaemonSetResource[] = [
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "fluent-bit",
      namespace: "kube-system",
      uid: uid("ds"),
      createdAt: daysAgo(150),
      labels: { app: "fluent-bit", tier: "logging" },
    },
    spec: { image: "fluent/fluent-bit:3.1.9" },
    status: { level: "Healthy", desired: 4, current: 4, ready: 4 },
  },
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "node-exporter",
      namespace: "kube-system",
      uid: uid("ds"),
      createdAt: daysAgo(150),
      labels: { app: "node-exporter", tier: "monitoring" },
    },
    spec: { image: "prom/node-exporter:v1.8.2" },
    status: { level: "Healthy", desired: 4, current: 4, ready: 4 },
  },
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "rook-ceph-agent",
      namespace: "rook-ceph",
      uid: uid("ds"),
      createdAt: daysAgo(96),
      labels: { app: "rook-ceph-agent" },
    },
    spec: { image: "rook/ceph:v1.15.3" },
    status: { level: "Healthy", desired: 4, current: 4, ready: 4 },
  },
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "ingress-nginx-controller-ds",
      namespace: "ingress-nginx",
      uid: uid("ds"),
      createdAt: daysAgo(40),
      labels: { app: "ingress-nginx" },
    },
    spec: { image: "registry.k8s.io/ingress-nginx/controller:v1.11.3" },
    status: {
      level: "Warning",
      desired: 4,
      current: 3,
      ready: 3,
      message: "1 node not scheduled due to taint",
    },
  },
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "security-scanner-agent",
      namespace: "mnemo-system",
      uid: uid("ds"),
      createdAt: hoursAgo(10),
      labels: { app: "security-scanner-agent" },
    },
    spec: { image: "ghcr.io/acme/security-scanner-agent:1.2.0" },
    status: {
      level: "Progressing",
      desired: 4,
      current: 2,
      ready: 1,
      message: "Rolling out to all nodes",
    },
  },
];
