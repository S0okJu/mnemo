import { test, expect } from "@playwright/test";
import { load } from "js-yaml";

test("resource lists use filters and preserve URL state through details and related resources", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/kubernetes/workload");
  const menu = page.getByRole("navigation", { name: "Component features" });
  await expect(
    menu.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "Top issues", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search resources by name" }),
  ).toHaveCount(0);
  await menu.getByRole("link", { name: "Deployment", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search resources by name" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search resources by name", exact: true })
    .fill("mnemo");
  await page
    .getByLabel("Namespace", { exact: true })
    .selectOption("mnemo-system");
  const nameSort = page.getByRole("button", { name: "Name", exact: true });
  await nameSort.click();
  await expect(page).toHaveURL(/sort=name/);
  await nameSort.click();
  await expect(page).toHaveURL(/dir=desc/);
  await expect(
    page.getByRole("columnheader", { name: "Name", exact: true }),
  ).toHaveAttribute("aria-sort", "descending");
  await page.getByLabel("Rows per page", { exact: true }).selectOption("25");
  await expect(page).toHaveURL(/type=Deployment/);
  const listUrl = page.url();
  await page.getByRole("link", { name: "mnemo-api", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "mnemo-api", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Recent events", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /^Pod \(\d+\)$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/resource-detail.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(page).toHaveURL(/tab=events/);
  await expect(page.getByText(/Scaled up to .* replicas/)).toBeVisible();
  await page.getByRole("tab", { name: "YAML", exact: true }).click();
  await expect(page).toHaveURL(/tab=yaml/);
  const yaml = await page
    .getByRole("region", { name: "Resource YAML", exact: true })
    .locator("code")
    .innerText();
  expect(load(yaml)).toMatchObject({
    kind: "Deployment",
    metadata: { name: "mnemo-api" },
  });
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "YAML", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("link", {
      name: "View Pod mnemo-api-pod-0 in mnemo-system",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "mnemo-api-pod-0", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to list", exact: true }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(
    page.getByRole("textbox", {
      name: "Search resources by name",
      exact: true,
    }),
  ).toHaveValue("mnemo");
  await expect(page.getByLabel("Namespace", { exact: true })).toHaveValue(
    "mnemo-system",
  );
  await expect(
    page.getByRole("columnheader", { name: "Name", exact: true }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByLabel("Rows per page", { exact: true })).toHaveValue(
    "25",
  );
  expect(errors).toEqual([]);
});

test("legacy type links select local features; single kinds open directly to a list", async ({
  page,
}) => {
  await page.goto("/kubernetes/config?tab=ConfigMap");
  const menu = page.getByRole("navigation", { name: "Component features" });
  await expect(
    menu.getByRole("link", { name: "ConfigMap", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search resources by name", exact: true })
    .fill("mnemo");
  await expect(page).toHaveURL(/type=ConfigMap/);
  await menu.getByRole("link", { name: "Secret", exact: true }).click();
  await expect(page).toHaveURL(/type=Secret/);
  await page.goBack();
  await expect(
    menu.getByRole("link", { name: "ConfigMap", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/kubernetes/node");
  await expect(
    page.getByRole("navigation", { name: "Component features" }),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toBeVisible();
});

test("filters have a resettable empty state and sorting and paging survive reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.origin,
      );
      if (url.pathname === "/api/v1/pods") {
        const items = Array.from({ length: 26 }, (_, index) => ({
          kind: "Pod",
          metadata: {
            name: `test-pod-${index}`,
            namespace: "default",
            uid: `pod-${index}`,
            createdAt: "2026-01-01T00:00:00Z",
          },
          spec: { image: "app:1", containerCount: 1, nodeName: "node-1" },
          status: {
            level: index % 2 ? "Healthy" : "Error",
            phase: index % 2 ? "Running" : "Failed",
            restarts: 0,
          },
        }));
        return Promise.resolve(Response.json({ items, total: items.length }));
      }
      return originalFetch(input, init);
    };
  });
  await page.goto(
    "/kubernetes/workload?view=resources&type=Pod&sort=name&dir=desc&page=2&pageSize=10",
  );
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search resources by name", exact: true })
    .fill("no-such-resource");
  await expect(
    page.getByRole("heading", { name: "No resources found", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Resource pagination", exact: true }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/page=2/);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("Error");
  await expect(page).toHaveURL(/status=Error/);
  await page.reload();
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Error");
  await expect(
    page.getByRole("table").getByText("Healthy", { exact: true }),
  ).toHaveCount(0);
});

test("Kube-OVN gateway types open directly from the local menu", async ({
  page,
}) => {
  await page.goto("/cni/kube-ovn/gateways?view=resources");
  await expect(page).toHaveURL(/\/resources\/nat-gateway$/);
  const menu = page.getByRole("navigation", {
    name: "Kube-OVN resources",
    exact: true,
  });
  await menu.getByRole("link", { name: "OvnDnatRule", exact: true }).click();
  await expect(page).toHaveURL(/\/resources\/ovn-dnat$/);
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("link", { name: "tenant-ovn-dnat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "tenant-ovn-dnat", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No events", exact: true }),
  ).toBeVisible();
});

test("the local drawer and detail tabs support keyboard navigation on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cni/kube-ovn/resources/ovn-dnat");
  await page
    .getByRole("button", { name: /OvnDnatRule.*Kube-OVN resources/ })
    .press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "OvnFip", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(/\/resources\/ovn-fip$/);
  await expect(
    page.getByRole("list", { name: "Resource results", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/resources-mobile.png",
    fullPage: true,
  });
});

test("the removed Kube-OVN Components URL opens the overview and missing resources show an error", async ({
  page,
}) => {
  await page.goto("/cni/kube-ovn/components");
  await expect(page).toHaveURL(/\/cni\/kube-ovn$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Kube-OVN overview" }),
  ).toBeVisible();
  await page.goto("/kubernetes/workload/pod/default/missing-resource");
  await expect(
    page.getByRole("heading", { name: "Resource not found", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
});

test("resource list layout fits desktop and produces a reviewable preview", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload?view=resources");
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/resources-desktop.png",
    fullPage: true,
  });
});

test("list filters and menu selection stay stable during background polling", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/cni/kube-ovn/resources/ovn-dnat");
  await expect(page.getByRole("table")).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search resources by name",
  });
  await search.fill("tenant");
  await page.clock.fastForward(42000);
  await expect(search).toHaveValue("tenant");
  await expect(
    page
      .getByRole("navigation", { name: "Kube-OVN resources" })
      .getByRole("link", { name: "OvnDnatRule", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
