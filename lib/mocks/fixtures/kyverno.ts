import type { KyvernoPolicyResource } from "@/lib/resource-registry/kinds/kyverno-policy";
import type { KyvernoPolicyReportResource } from "@/lib/resource-registry/kinds/kyverno-policy-report";
import type { KyvernoPolicyReportResultEntry } from "@/features/resource-explorer/lib/policy-report-results";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const kyvernoPolicies: KyvernoPolicyResource[] = [
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "require-pod-resource-limits",
      namespace: "mnemo-system",
      uid: uid("kypol"),
      createdAt: daysAgo(60),
      labels: { "policy.kyverno.io/category": "best-practices" },
    },
    spec: {
      rulesCount: 2,
      validationFailureAction: "Enforce",
      background: true,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "disallow-latest-tag",
      namespace: "mnemo-system",
      uid: uid("kypol"),
      createdAt: daysAgo(60),
      labels: { "policy.kyverno.io/category": "best-practices" },
    },
    spec: {
      rulesCount: 1,
      validationFailureAction: "Enforce",
      background: true,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "require-run-as-non-root",
      namespace: "default",
      uid: uid("kypol"),
      createdAt: daysAgo(45),
      labels: { "policy.kyverno.io/category": "pod-security" },
    },
    spec: { rulesCount: 1, validationFailureAction: "Audit", background: true },
    status: { level: "Warning", message: "3 resources failing in audit mode" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "restrict-image-registries",
      namespace: "default",
      uid: uid("kypol"),
      createdAt: daysAgo(20),
      labels: { "policy.kyverno.io/category": "supply-chain" },
    },
    spec: {
      rulesCount: 1,
      validationFailureAction: "Enforce",
      background: false,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "require-labels",
      namespace: "default",
      uid: uid("kypol"),
      createdAt: daysAgo(90),
      labels: { "policy.kyverno.io/category": "best-practices" },
    },
    spec: { rulesCount: 3, validationFailureAction: "Audit", background: true },
    status: { level: "Healthy" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "disallow-privileged-containers",
      namespace: "kube-system",
      uid: uid("kypol"),
      createdAt: daysAgo(100),
      labels: { "policy.kyverno.io/category": "pod-security" },
    },
    spec: {
      rulesCount: 1,
      validationFailureAction: "Enforce",
      background: true,
    },
    status: { level: "Error", message: "Webhook failing to reach API server" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "add-default-network-policy",
      namespace: "default",
      uid: uid("kypol"),
      createdAt: hoursAgo(8),
      labels: { "policy.kyverno.io/category": "network" },
    },
    spec: {
      rulesCount: 1,
      validationFailureAction: "Audit",
      background: false,
    },
    status: { level: "Progressing", message: "Rolling out to all namespaces" },
  },
  {
    kind: "KyvernoPolicy",
    apiVersion: "kyverno.io/v1",
    metadata: {
      name: "verify-image-signatures",
      namespace: "mnemo-system",
      uid: uid("kypol"),
      createdAt: daysAgo(5),
      labels: { "policy.kyverno.io/category": "supply-chain" },
    },
    spec: {
      rulesCount: 1,
      validationFailureAction: "Enforce",
      background: false,
    },
    status: { level: "Healthy" },
  },
];

function policyResult(
  result: KyvernoPolicyReportResultEntry["result"],
  policy: string,
  rule: string,
  resource: string,
  severity?: string,
): KyvernoPolicyReportResultEntry {
  return { policy, rule, result, resource, severity, source: "kyverno" };
}

/** Summary and level are derived from results so the two never disagree. */
function policyReport(
  name: string,
  namespace: string,
  scope: string,
  results: KyvernoPolicyReportResultEntry[],
  createdAt = daysAgo(1),
): KyvernoPolicyReportResource {
  const count = (result: string) =>
    results.filter((entry) => entry.result === result).length;
  const summary = {
    pass: count("pass"),
    fail: count("fail"),
    warn: count("warn"),
    error: count("error"),
    skip: count("skip"),
  };
  return {
    kind: "KyvernoPolicyReport",
    apiVersion: "wgpolicyk8s.io/v1alpha2",
    metadata: {
      name,
      namespace,
      uid: uid("kyrep"),
      createdAt,
      labels: { "app.kubernetes.io/managed-by": "kyverno" },
    },
    spec: { scope, results },
    status: {
      level:
        summary.fail || summary.error
          ? "Error"
          : summary.warn
            ? "Warning"
            : summary.pass
              ? "Healthy"
              : "Unknown",
      ...summary,
    },
  };
}

export const kyvernoPolicyReports: KyvernoPolicyReportResource[] = [
  policyReport("polr-neutron-rpc-server", "openstack", "Deployment", [
    policyResult(
      "pass",
      "require-resource-requests-limits",
      "require-container-requests-limits",
      "Deployment/openstack/neutron-rpc-server",
      "medium",
    ),
  ]),
  policyReport("polr-mnemo-api", "mnemo-system", "Deployment", [
    policyResult(
      "pass",
      "require-pod-resource-limits",
      "validate-resources",
      "Deployment/mnemo-system/mnemo-api",
      "medium",
    ),
    policyResult(
      "pass",
      "disallow-latest-tag",
      "validate-image-tag",
      "Deployment/mnemo-system/mnemo-api",
      "medium",
    ),
    policyResult(
      "warn",
      "verify-image-signatures",
      "verify-signature",
      "Deployment/mnemo-system/mnemo-api",
      "high",
    ),
  ]),
  policyReport("polr-payments-worker", "default", "Deployment", [
    policyResult(
      "fail",
      "require-run-as-non-root",
      "run-as-non-root",
      "Deployment/default/payments-worker",
      "high",
    ),
    policyResult(
      "fail",
      "disallow-latest-tag",
      "validate-image-tag",
      "Deployment/default/payments-worker",
      "medium",
    ),
    policyResult(
      "warn",
      "require-labels",
      "check-team-label",
      "Deployment/default/payments-worker",
      "low",
    ),
    policyResult(
      "pass",
      "restrict-image-registries",
      "validate-registries",
      "Deployment/default/payments-worker",
      "medium",
    ),
    policyResult(
      "skip",
      "add-default-network-policy",
      "generate-network-policy",
      "Deployment/default/payments-worker",
    ),
  ]),
  policyReport("polr-fluent-bit", "kube-system", "DaemonSet", [
    policyResult(
      "error",
      "disallow-privileged-containers",
      "privileged-containers",
      "DaemonSet/kube-system/fluent-bit",
      "high",
    ),
    policyResult(
      "pass",
      "require-pod-resource-limits",
      "validate-resources",
      "DaemonSet/kube-system/fluent-bit",
      "medium",
    ),
  ]),
  policyReport("polr-ns-default", "default", "Namespace", [
    policyResult(
      "pass",
      "require-labels",
      "check-namespace-labels",
      "Namespace/default",
      "low",
    ),
  ]),
  policyReport(
    "polr-mnemo-postgres",
    "mnemo-system",
    "StatefulSet",
    [
      policyResult(
        "pass",
        "require-run-as-non-root",
        "run-as-non-root",
        "StatefulSet/mnemo-system/mnemo-postgres",
        "high",
      ),
    ],
    hoursAgo(10),
  ),
];
