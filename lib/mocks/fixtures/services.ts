import type { ServiceResource } from "@/lib/resource-registry/kinds/service";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const services: ServiceResource[] = [
  {
    kind: "Service",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api",
      namespace: "mnemo-system",
      uid: uid("svc"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: {
      type: "ClusterIP",
      clusterIP: "10.96.14.22",
      ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Service",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-postgres-headless",
      namespace: "mnemo-system",
      uid: uid("svc"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      type: "ClusterIP",
      clusterIP: "None",
      ports: [{ port: 5432, targetPort: 5432, protocol: "TCP" }],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Service",
    apiVersion: "v1",
    metadata: {
      name: "ingress-nginx-controller",
      namespace: "ingress-nginx",
      uid: uid("svc"),
      createdAt: daysAgo(120),
      labels: { app: "ingress-nginx" },
    },
    spec: {
      type: "LoadBalancer",
      clusterIP: "10.96.200.1",
      ports: [
        { port: 80, targetPort: 8080, protocol: "TCP" },
        { port: 443, targetPort: 8443, protocol: "TCP" },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Service",
    apiVersion: "v1",
    metadata: {
      name: "redis-cluster-headless",
      namespace: "default",
      uid: uid("svc"),
      createdAt: daysAgo(20),
      labels: { app: "redis-cluster" },
    },
    spec: {
      type: "ClusterIP",
      clusterIP: "None",
      ports: [{ port: 6379, targetPort: 6379, protocol: "TCP" }],
    },
    status: { level: "Warning", message: "No ready endpoints" },
  },
  {
    kind: "Service",
    apiVersion: "v1",
    metadata: {
      name: "payments-worker",
      namespace: "default",
      uid: uid("svc"),
      createdAt: hoursAgo(5),
      labels: { app: "payments-worker" },
    },
    spec: {
      type: "NodePort",
      clusterIP: "10.96.88.4",
      ports: [{ port: 8080, targetPort: 8080, protocol: "TCP" }],
    },
    status: { level: "Progressing", message: "Endpoints still registering" },
  },
];
