import { test, expect } from "@playwright/test";
import {
  policyResultLevel,
  sortPolicyResults,
} from "../../features/resource-explorer/lib/policy-report-results";
import type { KyvernoPolicyReportResultEntry } from "../../features/resource-explorer/lib/policy-report-results";

const entry = (result: string, policy = "p", rule = "r") =>
  ({
    policy,
    rule,
    result,
    resource: "Deployment/default/app",
  }) as KyvernoPolicyReportResultEntry;

test("sortPolicyResults puts problems first and unknown results last", () => {
  const sorted = sortPolicyResults([
    entry("pass"),
    entry("future"),
    entry("skip"),
    entry("warn"),
    entry("error"),
    entry("fail", "b"),
    entry("fail", "a"),
  ]);
  expect(sorted.map((e) => `${e.result}:${e.policy}`)).toEqual([
    "fail:a",
    "fail:b",
    "error:p",
    "warn:p",
    "skip:p",
    "pass:p",
    "future:p",
  ]);
});

test("policyResultLevel maps results to status levels", () => {
  expect(policyResultLevel("pass")).toBe("Healthy");
  expect(policyResultLevel("fail")).toBe("Error");
  expect(policyResultLevel("error")).toBe("Error");
  expect(policyResultLevel("warn")).toBe("Warning");
  expect(policyResultLevel("skip")).toBe("Unknown");
  expect(policyResultLevel("future")).toBe("Unknown");
});

test("policy report detail lists passing results", async ({ page }) => {
  await page.goto(
    "/security/kyverno/policy-report/openstack/polr-neutron-rpc-server",
  );
  const results = page.getByRole("region", { name: "Results" });
  const row = results
    .getByRole("row")
    .filter({ hasText: "require-container-requests-limits" });
  await expect(row).toBeVisible();
  await expect(row.getByText("pass", { exact: true })).toBeVisible();
  await expect(row.getByText("require-resource-requests-limits")).toBeVisible();
  await expect(row.getByText("neutron-rpc-server")).toBeVisible();
});

test("policy report detail sorts failures above passes and links targets", async ({
  page,
}) => {
  await page.goto(
    "/security/kyverno/policy-report/default/polr-payments-worker",
  );
  const rows = page.getByRole("region", { name: "Results" }).getByRole("row");
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(1)).toContainText("fail");
  await expect(rows.nth(5)).toContainText("pass");
  await expect(
    rows.nth(1).getByRole("link", { name: "payments-worker" }),
  ).toHaveAttribute(
    "href",
    /\/kubernetes\/workload\/deployment\/default\/payments-worker/,
  );
});
