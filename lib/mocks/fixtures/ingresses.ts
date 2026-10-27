import type { IngressResource } from "@/lib/resource-registry/kinds/ingress";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const ingresses: IngressResource[] = [
  {
    kind: "Ingress",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "mnemo-web",
      namespace: "mnemo-system",
      uid: uid("ing"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-web" },
    },
    spec: {
      className: "nginx",
      rules: [
        {
          host: "mnemo.example.com",
          path: "/",
          backendService: "mnemo-web:80",
        },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Ingress",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "mnemo-api",
      namespace: "mnemo-system",
      uid: uid("ing"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: {
      className: "nginx",
      rules: [
        {
          host: "api.mnemo.example.com",
          path: "/v1",
          backendService: "mnemo-api:80",
        },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Ingress",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "internal-grafana",
      namespace: "kube-system",
      uid: uid("ing"),
      createdAt: daysAgo(150),
      labels: { app: "grafana" },
    },
    spec: {
      className: "nginx-internal",
      rules: [
        { host: "grafana.internal", path: "/", backendService: "grafana:3000" },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "Ingress",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "payments-gateway",
      namespace: "default",
      uid: uid("ing"),
      createdAt: hoursAgo(5),
      labels: { app: "payments-worker" },
    },
    spec: {
      className: "nginx",
      rules: [
        {
          host: "payments.example.com",
          path: "/",
          backendService: "payments-worker:8080",
        },
      ],
    },
    status: { level: "Warning", message: "TLS certificate expiring in 3 days" },
  },
];
