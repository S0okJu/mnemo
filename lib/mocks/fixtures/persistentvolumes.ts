import type { PersistentVolumeResource } from "@/lib/resource-registry/kinds/persistentvolume";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const persistentvolumes: PersistentVolumeResource[] = [
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    metadata: {
      name: "pv-mnemo-postgres-0",
      uid: uid("pv"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      capacity: "20Gi",
      accessModes: ["ReadWriteOnce"],
      storageClassName: "rook-ceph-block",
      reclaimPolicy: "Retain",
    },
    status: { level: "Healthy", message: "Bound" },
  },
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    metadata: {
      name: "pv-mnemo-postgres-1",
      uid: uid("pv"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      capacity: "20Gi",
      accessModes: ["ReadWriteOnce"],
      storageClassName: "rook-ceph-block",
      reclaimPolicy: "Retain",
    },
    status: { level: "Healthy", message: "Bound" },
  },
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    metadata: {
      name: "pv-redis-cluster-0",
      uid: uid("pv"),
      createdAt: daysAgo(20),
      labels: { app: "redis-cluster" },
    },
    spec: {
      capacity: "8Gi",
      accessModes: ["ReadWriteOnce"],
      storageClassName: "rook-ceph-block",
      reclaimPolicy: "Delete",
    },
    status: { level: "Warning", message: "Node pressure, rescheduling" },
  },
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    metadata: {
      name: "pv-legacy-archive",
      uid: uid("pv"),
      createdAt: daysAgo(400),
      labels: {},
    },
    spec: {
      capacity: "100Gi",
      accessModes: ["ReadOnlyMany"],
      storageClassName: "standard",
      reclaimPolicy: "Retain",
    },
    status: { level: "Unknown", message: "Released, awaiting manual reclaim" },
  },
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    metadata: {
      name: "pv-kafka-broker-0",
      uid: uid("pv"),
      createdAt: hoursAgo(14),
      labels: { app: "kafka-broker" },
    },
    spec: {
      capacity: "50Gi",
      accessModes: ["ReadWriteOnce"],
      storageClassName: "rook-ceph-block",
      reclaimPolicy: "Delete",
    },
    status: { level: "Progressing", message: "Provisioning" },
  },
];
