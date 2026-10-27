import type { NetworkPolicyResource } from "@/lib/resource-registry/kinds/networkpolicy";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const networkpolicies: NetworkPolicyResource[] = [
  {
    kind: "NetworkPolicy",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "default-deny-all",
      namespace: "mnemo-system",
      uid: uid("netpol"),
      createdAt: daysAgo(60),
      labels: {},
    },
    spec: {
      podSelector: "app=*",
      policyTypes: ["Ingress", "Egress"],
      ingressRules: 0,
      egressRules: 0,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "NetworkPolicy",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "allow-mnemo-api-ingress",
      namespace: "mnemo-system",
      uid: uid("netpol"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: {
      podSelector: "app=mnemo-api",
      policyTypes: ["Ingress"],
      ingressRules: 2,
      egressRules: 0,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "NetworkPolicy",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "allow-postgres-from-api",
      namespace: "mnemo-system",
      uid: uid("netpol"),
      createdAt: daysAgo(60),
      labels: { app: "mnemo-postgres" },
    },
    spec: {
      podSelector: "app=mnemo-postgres",
      policyTypes: ["Ingress"],
      ingressRules: 1,
      egressRules: 0,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "NetworkPolicy",
    apiVersion: "networking.k8s.io/v1",
    metadata: {
      name: "restrict-payments-egress",
      namespace: "default",
      uid: uid("netpol"),
      createdAt: hoursAgo(5),
      labels: { app: "payments-worker" },
    },
    spec: {
      podSelector: "app=payments-worker",
      policyTypes: ["Egress"],
      ingressRules: 0,
      egressRules: 3,
    },
    status: { level: "Progressing", message: "Rolling out to all nodes" },
  },
];
