import { pods } from "@/lib/mocks/fixtures/pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import {
  kyvernoPolicies,
  kyvernoPolicyReports,
} from "@/lib/mocks/fixtures/kyverno";
import type { KyvernoPolicyResource } from "@/lib/resource-registry/kinds/kyverno-policy";
import type { KyvernoPolicyReportResource } from "@/lib/resource-registry/kinds/kyverno-policy-report";

export const kyvernoPolicyHandlers =
  createResourceHandlers<KyvernoPolicyResource>({
    kindPath: "kyverno/policies",
    items: kyvernoPolicies,
    subContent: (resource) =>
      pods
        .filter((pod) => pod.metadata.namespace === resource.metadata.namespace)
        .map((pod) => ({
          resource: `Pod/${pod.metadata.namespace}/${pod.metadata.name}`,
          result: "pass",
        })),
  });

export const kyvernoPolicyReportHandlers =
  createResourceHandlers<KyvernoPolicyReportResource>({
    kindPath: "kyverno/policy-reports",
    items: kyvernoPolicyReports,
    // Results ship in the detail payload; reports have no sub-content or events.
    subContent: () => [],
  });
