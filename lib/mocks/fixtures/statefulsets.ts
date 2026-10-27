import type { StatefulSetResource } from "@/lib/resource-registry/kinds/statefulset";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const statefulsets: StatefulSetResource[] = [
  {
    kind: "StatefulSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "mnemo-postgres",
      namespace: "mnemo-system",
      uid: uid("sts"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres", tier: "database" },
    },
    spec: {
      replicas: 3,
      serviceName: "mnemo-postgres-headless",
      image: "postgres:16.4",
    },
    status: { level: "Healthy", readyReplicas: 3 },
  },
  {
    kind: "StatefulSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "rook-ceph-mon",
      namespace: "rook-ceph",
      uid: uid("sts"),
      createdAt: daysAgo(96),
      labels: { app: "rook-ceph-mon" },
    },
    spec: {
      replicas: 3,
      serviceName: "rook-ceph-mon-headless",
      image: "rook/ceph:v1.15.3",
    },
    status: { level: "Healthy", readyReplicas: 3 },
  },
  {
    kind: "StatefulSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "redis-cluster",
      namespace: "default",
      uid: uid("sts"),
      createdAt: daysAgo(20),
      labels: { app: "redis-cluster", tier: "cache" },
    },
    spec: {
      replicas: 6,
      serviceName: "redis-cluster-headless",
      image: "redis:7.4.1",
    },
    status: {
      level: "Warning",
      readyReplicas: 5,
      message: "1 pod pending, insufficient CPU on node-2",
    },
  },
  {
    kind: "StatefulSet",
    apiVersion: "apps/v1",
    metadata: {
      name: "kafka-broker",
      namespace: "default",
      uid: uid("sts"),
      createdAt: hoursAgo(14),
      labels: { app: "kafka-broker", tier: "messaging" },
    },
    spec: {
      replicas: 3,
      serviceName: "kafka-broker-headless",
      image: "apache/kafka:3.8.0",
    },
    status: {
      level: "Progressing",
      readyReplicas: 2,
      message: "Scaling up to 3 replicas",
    },
  },
];
