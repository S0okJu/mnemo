import type { PersistentVolumeClaimResource } from "@/lib/resource-registry/kinds/persistentvolumeclaim";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const persistentvolumeclaims: PersistentVolumeClaimResource[] = [
  {
    kind: "PersistentVolumeClaim",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-postgres-data-0",
      namespace: "mnemo-system",
      uid: uid("pvc"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      storageClassName: "rook-ceph-block",
      accessModes: ["ReadWriteOnce"],
      requestedStorage: "20Gi",
    },
    status: { level: "Healthy" },
  },
  {
    kind: "PersistentVolumeClaim",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-postgres-data-1",
      namespace: "mnemo-system",
      uid: uid("pvc"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      storageClassName: "rook-ceph-block",
      accessModes: ["ReadWriteOnce"],
      requestedStorage: "20Gi",
    },
    status: { level: "Healthy" },
  },
  {
    kind: "PersistentVolumeClaim",
    apiVersion: "v1",
    metadata: {
      name: "redis-cluster-data",
      namespace: "default",
      uid: uid("pvc"),
      createdAt: daysAgo(20),
      labels: { app: "redis-cluster" },
    },
    spec: {
      storageClassName: "rook-ceph-block",
      accessModes: ["ReadWriteOnce"],
      requestedStorage: "8Gi",
    },
    status: { level: "Warning", message: "Bound volume under node pressure" },
  },
  {
    kind: "PersistentVolumeClaim",
    apiVersion: "v1",
    metadata: {
      name: "kafka-broker-data",
      namespace: "default",
      uid: uid("pvc"),
      createdAt: hoursAgo(14),
      labels: { app: "kafka-broker" },
    },
    spec: {
      storageClassName: "rook-ceph-block",
      accessModes: ["ReadWriteOnce"],
      requestedStorage: "50Gi",
    },
    status: {
      level: "Progressing",
      message: "Waiting for volume provisioning",
    },
  },
];
