import type { ResourceStatusLevel } from "@/lib/api/types";

export const policyResultOrder = [
  "fail",
  "error",
  "warn",
  "skip",
  "pass",
] as const;

export type KyvernoPolicyResult = (typeof policyResultOrder)[number];

export interface KyvernoPolicyReportResultEntry {
  policy: string;
  rule: string;
  result: KyvernoPolicyResult;
  /** Kind/namespace/name, or Kind/name for cluster-scoped targets. */
  resource: string;
  severity?: string;
  source?: string;
  scored?: boolean;
  timestamp?: string;
}

const policyResultLevels: Record<KyvernoPolicyResult, ResourceStatusLevel> = {
  fail: "Error",
  error: "Error",
  warn: "Warning",
  skip: "Unknown",
  pass: "Healthy",
};

/** Results Kyverno may add later render as Unknown instead of crashing. */
export function policyResultLevel(result: string): ResourceStatusLevel {
  return policyResultLevels[result as KyvernoPolicyResult] ?? "Unknown";
}

function rank(result: string) {
  const index = policyResultOrder.indexOf(result as KyvernoPolicyResult);
  return index === -1 ? policyResultOrder.length : index;
}

/** Problems first, then policy and rule name, so failures are never below the fold. */
export function sortPolicyResults(results: KyvernoPolicyReportResultEntry[]) {
  return [...results].sort(
    (a, b) =>
      rank(a.result) - rank(b.result) ||
      a.policy.localeCompare(b.policy) ||
      a.rule.localeCompare(b.rule) ||
      a.resource.localeCompare(b.resource),
  );
}
