import type { RbacRoleResource } from "@/lib/resource-registry/kinds/rbac-role";
import type { RbacRoleBindingResource } from "@/lib/resource-registry/kinds/rbac-role-binding";
import type { RbacServiceAccountResource } from "@/lib/resource-registry/kinds/rbac-service-account";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const rbacRoles: RbacRoleResource[] = [
  {
    kind: "RbacRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "pod-reader",
      namespace: "default",
      uid: uid("role"),
      createdAt: daysAgo(80),
      labels: { "rbac.mnemo.io/scope": "readonly" },
    },
    spec: {
      rules: [
        {
          apiGroups: [""],
          resources: ["pods"],
          verbs: ["get", "list", "watch"],
        },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "deployment-manager",
      namespace: "mnemo-system",
      uid: uid("role"),
      createdAt: daysAgo(55),
      labels: { "rbac.mnemo.io/scope": "readwrite" },
    },
    spec: {
      rules: [
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["get", "list", "watch", "update", "patch"],
        },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "secret-admin",
      namespace: "default",
      uid: uid("role"),
      createdAt: daysAgo(10),
      labels: { "rbac.mnemo.io/scope": "admin" },
    },
    spec: {
      rules: [{ apiGroups: [""], resources: ["secrets"], verbs: ["*"] }],
    },
    status: {
      level: "Warning",
      message: "Overly broad verbs ('*') detected by policy audit",
    },
  },
  {
    kind: "RbacRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "kyverno-policy-viewer",
      namespace: "mnemo-system",
      uid: uid("role"),
      createdAt: hoursAgo(5),
      labels: { "rbac.mnemo.io/scope": "readonly" },
    },
    spec: {
      rules: [
        {
          apiGroups: ["kyverno.io"],
          resources: ["policies", "policyreports"],
          verbs: ["get", "list"],
        },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "ingress-controller-role",
      namespace: "ingress-nginx",
      uid: uid("role"),
      createdAt: daysAgo(120),
      labels: { "app.kubernetes.io/component": "controller" },
    },
    spec: {
      rules: [
        {
          apiGroups: [""],
          resources: ["configmaps", "endpoints", "services"],
          verbs: ["get", "list", "watch"],
        },
      ],
    },
    status: { level: "Healthy" },
  },
];

export const rbacRoleBindings: RbacRoleBindingResource[] = [
  {
    kind: "RbacRoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "pod-reader-binding",
      namespace: "default",
      uid: uid("rb"),
      createdAt: daysAgo(80),
      labels: {},
    },
    spec: {
      roleRef: "Role/pod-reader",
      subjects: [{ kind: "ServiceAccount", name: "monitoring-agent" }],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacRoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "deployment-manager-binding",
      namespace: "mnemo-system",
      uid: uid("rb"),
      createdAt: daysAgo(55),
      labels: {},
    },
    spec: {
      roleRef: "Role/deployment-manager",
      subjects: [
        { kind: "ServiceAccount", name: "ci-deployer" },
        { kind: "User", name: "ops-team" },
      ],
    },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacRoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "secret-admin-binding",
      namespace: "default",
      uid: uid("rb"),
      createdAt: daysAgo(10),
      labels: {},
    },
    spec: {
      roleRef: "Role/secret-admin",
      subjects: [{ kind: "User", name: "jane.doe" }],
    },
    status: {
      level: "Warning",
      message: "Bound to overly broad role 'secret-admin'",
    },
  },
  {
    kind: "RbacRoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: {
      name: "kyverno-policy-viewer-binding",
      namespace: "mnemo-system",
      uid: uid("rb"),
      createdAt: hoursAgo(5),
      labels: {},
    },
    spec: {
      roleRef: "Role/kyverno-policy-viewer",
      subjects: [{ kind: "ServiceAccount", name: "mnemo-api" }],
    },
    status: { level: "Healthy" },
  },
];

export const rbacServiceAccounts: RbacServiceAccountResource[] = [
  {
    kind: "RbacServiceAccount",
    apiVersion: "v1",
    metadata: {
      name: "mnemo-api",
      namespace: "mnemo-system",
      uid: uid("sa"),
      createdAt: daysAgo(42),
      labels: { app: "mnemo-api" },
    },
    spec: { secrets: ["mnemo-api-token-x7k2p"] },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacServiceAccount",
    apiVersion: "v1",
    metadata: {
      name: "ci-deployer",
      namespace: "mnemo-system",
      uid: uid("sa"),
      createdAt: daysAgo(55),
      labels: { "app.kubernetes.io/managed-by": "ci" },
    },
    spec: { secrets: ["ci-deployer-token-q9n3z"] },
    status: { level: "Healthy" },
  },
  {
    kind: "RbacServiceAccount",
    apiVersion: "v1",
    metadata: {
      name: "monitoring-agent",
      namespace: "default",
      uid: uid("sa"),
      createdAt: daysAgo(80),
      labels: { app: "monitoring-agent" },
    },
    spec: { secrets: [] },
    status: { level: "Warning", message: "No token secret bound" },
  },
  {
    kind: "RbacServiceAccount",
    apiVersion: "v1",
    metadata: {
      name: "default",
      namespace: "kube-system",
      uid: uid("sa"),
      createdAt: daysAgo(365),
      labels: {},
    },
    spec: { secrets: ["default-token-abcde"] },
    status: { level: "Healthy" },
  },
];
