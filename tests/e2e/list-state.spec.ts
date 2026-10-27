import { test, expect } from "@playwright/test";
import {
  readListState,
  filterAndSortRows,
  safeReturnTo,
  resourceDetailHref,
  withReturnTo,
} from "../../features/resource-explorer/lib/list-state";
import type { ResourceRow } from "../../features/resource-explorer/lib/list-state";
const kinds = ["Pod", "Deployment"];
const read = (query: string) =>
  readListState(new URLSearchParams(query), kinds);
const row = (
  kind: string,
  name: string,
  namespace: string | undefined,
  level: "Healthy" | "Error" | "Warning",
  date: string,
): ResourceRow => ({
  listHref: `/kubernetes/workload/${kind.toLowerCase()}`,
  item: {
    kind,
    metadata: { name, namespace, uid: `${kind}-${name}`, createdAt: date },
    status: { level },
  },
});
const rows = [
  row("Pod", "web-1", "team-a", "Healthy", "2026-01-03"),
  row("Pod", "web-2", "team-b", "Error", "2026-01-02"),
  row("Deployment", "web", "team-a", "Warning", "2026-01-01"),
  row("Node", "node-1", undefined, "Healthy", "2025-12-01"),
];
test("URL parsing supports legacy links, single-kind defaults, and malformed parameters", () => {
  expect(read("").view).toBe("overview");
  expect(read("tab=Pod")).toMatchObject({ view: "resources", type: "Pod" });
  expect(read("tab=all").view).toBe("overview");
  expect(read("view=overview&type=Pod").view).toBe("overview");
  expect(readListState(new URLSearchParams(), ["Node"]).view).toBe("resources");
  expect(
    read("page=-3&pageSize=999&sort=bad&status=broken&type=Missing"),
  ).toMatchObject({
    page: 1,
    pageSize: 10,
    sort: "severity",
    status: "all",
    type: "all",
  });
});
test("combined filters, cluster scope, and sorting operate before pagination", () => {
  expect(
    filterAndSortRows(
      rows,
      read("type=Pod&q=WEB&namespace=team-b&status=Error"),
    ).map(({ item }) => item.metadata.name),
  ).toEqual(["web-2"]);
  expect(
    filterAndSortRows(rows, read("namespace=_")).map(
      ({ item }) => item.metadata.name,
    ),
  ).toEqual(["node-1"]);
  expect(
    filterAndSortRows(rows, read("sort=age&dir=asc")).map(
      ({ item }) => item.metadata.name,
    ),
  ).toEqual(["node-1", "web", "web-2", "web-1"]);
  expect(
    filterAndSortRows(rows, read("sort=name&dir=desc")).map(
      ({ item }) => item.metadata.name,
    ),
  ).toEqual(["web-2", "web-1", "web", "node-1"]);
  expect(
    filterAndSortRows(rows, read("")).map(({ item }) => item.status.level),
  ).toEqual(["Error", "Warning", "Healthy", "Healthy"]);
  expect(rows[0].item.metadata.name).toBe("web-1");
});
test("detail links preserve encoded list state and reject external return targets", () => {
  const returnTo =
    "/kubernetes/workload?view=resources&q=web%26api&type=Pod&page=2&sort=name";
  const href = resourceDetailHref(
    "/kubernetes/workload/pod",
    rows[0].item,
    returnTo,
  );
  const url = new URL(href, "https://mnemo.local");
  expect(url.pathname).toBe("/kubernetes/workload/pod/team-a/web-1");
  expect(url.searchParams.get("returnTo")).toBe(returnTo);
  expect(
    new URL(
      withReturnTo("/kubernetes/node/_/node-1", returnTo),
      "https://mnemo.local",
    ).searchParams.get("returnTo"),
  ).toBe(returnTo);
  for (const unsafe of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/integrations",
    "/kubernetes/../../../external",
  ]) {
    expect(safeReturnTo(unsafe)).toBeUndefined();
  }
  expect(safeReturnTo(returnTo)).toBe(returnTo);
});
