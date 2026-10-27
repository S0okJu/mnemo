import { test, expect } from "@playwright/test";

test("simple components select resource lists through flat local links", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload");
  const menu = page.getByRole("navigation", { name: "Component features" });
  await expect(
    menu.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Deployment", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search resources by name" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search resources by name" })
    .fill("mnemo");
  const list = page.url();
  await page.getByRole("link", { name: "mnemo-api", exact: true }).click();
  await expect(page.getByRole("region", { name: /Pod \(/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to list" }).click();
  await expect(page).toHaveURL(list);
  await page.reload();
  await expect(
    menu.getByRole("link", { name: "Deployment", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("Kube-OVN section URLs open type lists and the drawer lists every type", async ({
  page,
}) => {
  await page.goto("/cni/kube-ovn/networks");
  await expect(page).toHaveURL(/\/cni\/kube-ovn\/resources\/vpc$/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Resource summary")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Vpc.*Kube-OVN resources/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer
    .getByRole("link", { name: "SecurityGroup", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await expect(page).toHaveURL(/\/resources\/security-group$/);
  await expect(
    page.getByRole("button", { name: /SecurityGroup.*Kube-OVN resources/ }),
  ).toBeVisible();
});

test("every implemented component exposes only its supported flat features", async ({
  page,
}) => {
  const components = [
    [
      "/kubernetes/workload",
      [
        "Overview",
        "Deployment",
        "DaemonSet",
        "StatefulSet",
        "Pod",
        "ReplicaSet",
        "Job",
        "CronJob",
      ],
    ],
    [
      "/kubernetes/network",
      ["Overview", "Service", "Ingress", "NetworkPolicy"],
    ],
    ["/kubernetes/config", ["Overview", "ConfigMap", "Secret"]],
    ["/kubernetes/rbac", ["Overview", "ServiceAccount", "Role", "RoleBinding"]],
    ["/storage", ["Overview", "PersistentVolume", "PersistentVolumeClaim"]],
    ["/security", ["Overview", "Policy", "PolicyReport"]],
  ] as const;
  for (const [path, labels] of components) {
    await page.goto(path);
    const menu = page.getByRole("navigation", { name: "Component features" });
    await expect(menu.getByRole("link")).toHaveText([...labels]);
    for (const label of labels.slice(1)) {
      await menu.getByRole("link", { name: label, exact: true }).click();
      await expect(
        menu.getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByLabel("Resource summary")).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(0);
      await expect(page.getByRole("table")).toBeVisible();
    }
  }
  for (const path of ["/kubernetes/node", "/kubernetes/namespace"]) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "Component features" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Resource summary")).toBeVisible();
  }
  for (const [path, title] of [
    ["/network/traefik", "Traefik"],
    ["/storage/rook-ceph", "Rook-Ceph"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: `${title} integration coming soon` }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Component features" }),
    ).toHaveCount(0);
  }
});

test("Kube-OVN menu groups every type under feature headings and legacy type links redirect", async ({
  page,
}) => {
  await page.goto("/cni/kube-ovn");
  const menu = page.getByRole("navigation", { name: "Kube-OVN resources" });
  for (const heading of [
    "Networks",
    "IP Management",
    "Gateways & NAT",
    "Underlay",
    "Security",
  ])
    await expect(
      menu.getByRole("list", { name: heading, exact: true }),
    ).toBeVisible();
  await expect(menu.getByRole("link")).toHaveCount(17);
  await menu.getByRole("link", { name: "Subnet", exact: true }).click();
  await expect(page).toHaveURL(/\/resources\/subnet$/);
  await page
    .getByLabel("Resource summary")
    .getByRole("button", { name: /^Warning/ })
    .click();
  await expect(page).toHaveURL(/status=Warning/);
  await page.reload();
  await expect(
    menu.getByRole("link", { name: "Subnet", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/cni/kube-ovn/gateways?type=KubeOvnOvnDnatRule&q=tenant");
  await expect(page).toHaveURL(/\/resources\/ovn-dnat\?q=tenant$/);
  await expect(
    page.getByRole("textbox", { name: "Search resources by name" }),
  ).toHaveValue("tenant");
});

test("unavailable Kube-OVN types stay visible but disabled in the menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.origin,
      );
      const response = await originalFetch(input, init);
      if (url.pathname !== "/api/v1/integrations/kube-ovn/capabilities")
        return response;
      const body = await response.json();
      for (const resource of body.resources)
        if (resource.kind === "KubeOvnVlan") resource.available = false;
      return Response.json(body);
    };
  });
  await page.goto("/cni/kube-ovn");
  const menu = page.getByRole("navigation", { name: "Kube-OVN resources" });
  await expect(menu.getByRole("link", { name: "Vlan" })).toHaveCount(0);
  await expect(menu.getByText("Vlan", { exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(menu.getByRole("link")).toHaveCount(16);
});

test("containment relations summarize kinds with namespace-filtered list links", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.origin,
      );
      if (url.pathname === "/api/v1/namespaces/_/default/related") {
        return Promise.resolve(
          Response.json(
            ["Pod", "ConfigMap"].flatMap((kind) =>
              Array.from({ length: 8 }, (_, index) => ({
                kind,
                name: `${kind.toLowerCase()}-${index}`,
                namespace: "default",
              })),
            ),
          ),
        );
      }
      return originalFetch(input, init);
    };
  });
  await page.goto("/kubernetes/namespace/_/default");
  const summary = page.getByRole("table", {
    name: "Related resources by type",
  });
  await expect(summary.getByRole("row")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Open Pod list", exact: true }),
  ).toHaveAttribute("href", /^\/kubernetes\/workload\?.*namespace=default/);
  await expect(
    page.getByRole("link", { name: "Open ConfigMap list", exact: true }),
  ).toHaveAttribute("href", /^\/kubernetes\/config\?.*type=ConfigMap/);
  await expect(page.getByRole("region", { name: "Pod (8)" })).toHaveCount(0);
});

test("related groups preview five rows, expand, and collapse independently", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.origin,
      );
      if (url.pathname === "/api/v1/deployments/mnemo-system/mnemo-api/related")
        return Promise.resolve(
          Response.json({
            pods: Array.from({ length: 8 }, (_, index) => `pod-${index}`),
            events: [],
          }),
        );
      return originalFetch(input, init);
    };
  });
  await page.goto("/kubernetes/workload/deployment/mnemo-system/mnemo-api");
  const pods = page.getByRole("region", { name: "Pod (8)", exact: true });
  await expect(pods.getByRole("link")).toHaveCount(5);
  await pods
    .getByRole("button", { name: "Show all 8 Pods", exact: true })
    .press("Enter");
  await expect(pods.getByRole("link")).toHaveCount(8);
  await expect(
    pods.getByRole("link", {
      name: "View Pod pod-7 in mnemo-system",
      exact: true,
    }),
  ).toHaveAttribute("href", /\/kubernetes\/workload\/pod\/mnemo-system\/pod-7/);
  await pods
    .getByRole("button", { name: "Show fewer Pods", exact: true })
    .click();
  await expect(pods.getByRole("link")).toHaveCount(5);
  const header = pods.getByRole("button", { name: /^Pod/ });
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(pods.getByRole("link")).toHaveCount(0);
});

for (const [status, message] of [
  [403, "Insufficient permissions"],
  [500, "Unable to load related data"],
  [200, "No resources in this namespace"],
] as const) {
  test(`related resources distinguish response ${status}`, async ({ page }) => {
    await page.addInitScript(
      ({ status }) => {
        const originalFetch = window.fetch;
        window.fetch = (input, init) => {
          const url = new URL(
            input instanceof Request ? input.url : String(input),
            location.origin,
          );
          if (url.pathname === "/api/v1/namespaces/_/default/related")
            return Promise.resolve(
              Response.json(
                status === 200 ? [] : { message: "Request failed" },
                { status },
              ),
            );
          return originalFetch(input, init);
        };
      },
      { status },
    );
    await page.goto("/kubernetes/namespace/_/default");
    await expect(page.getByText(message, { exact: false })).toBeVisible();
  });
}

test("legacy list routes retain filters and returning from details keeps the selected feature", async ({
  page,
}) => {
  await page.goto(
    "/kubernetes/config/secret?q=mnemo&namespace=mnemo-system&pageSize=25&sort=name&dir=desc",
  );
  await expect(page).toHaveURL(/type=Secret/);
  await expect(page.getByLabel("Namespace", { exact: true })).toHaveValue(
    "mnemo-system",
  );
  await expect(page.getByLabel("Rows per page", { exact: true })).toHaveValue(
    "25",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page).toHaveURL(/type=Secret/);
  await expect(
    page
      .getByRole("navigation", { name: "Component features" })
      .getByRole("link", { name: "Secret", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(
    "/cni/kube-ovn/resources/subnet?q=tenant&status=Warning&pageSize=25",
  );
  await expect(page).toHaveURL(/\/cni\/kube-ovn\/resources\/subnet\?/);
  await expect(
    page.getByRole("textbox", { name: "Search resources by name" }),
  ).toHaveValue("tenant");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "Warning",
  );
});

test("keyboard local navigation, detail tabs, and sidebar collapse fit constrained screens", async ({
  page,
}) => {
  await page.goto("/kubernetes/config?type=ConfigMap");
  await page.setViewportSize({ width: 1024, height: 768 });
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1024);
  const before = (await table.boundingBox())!.width;
  await page.locator('[data-sidebar="trigger"]').click();
  await expect
    .poll(async () => (await table.boundingBox())!.width)
    .toBeGreaterThan(before);
  const secrets = page
    .getByRole("navigation", { name: "Component features" })
    .getByRole("link", { name: "Secret", exact: true });
  await secrets.focus();
  await secrets.press("Enter");
  await expect(page).toHaveURL(/type=Secret/);
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", {
    name: /Secret.*Component features/,
  });
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("link", { name: "ConfigMap", exact: true })
    .press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /ConfigMap.*Component features/ }),
  ).toBeVisible();
  await page.goto("/kubernetes/workload/deployment/mnemo-system/mnemo-api");
  await expect(
    page.getByRole("button", { name: /Deployment.*Component features/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page
    .getByRole("tab", { name: "Overview", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Events", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Events", exact: true }).press("Enter");
  await expect(
    page.getByRole("tab", { name: "Events", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("tab", { name: "Events", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "YAML", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "YAML", exact: true }).press("Enter");
  await expect(
    page.getByRole("tab", { name: "YAML", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/detail-mobile.png",
    fullPage: true,
  });
});

test("all core and Kyverno resource detail routes retain their owning local feature", async ({
  page,
}) => {
  test.setTimeout(90000);
  const features = [
    ["/kubernetes/workload", "Deployment", "Deployment"],
    ["/kubernetes/workload", "DaemonSet", "DaemonSet"],
    ["/kubernetes/workload", "StatefulSet", "StatefulSet"],
    ["/kubernetes/workload", "Pod", "Pod"],
    ["/kubernetes/workload", "ReplicaSet", "ReplicaSet"],
    ["/kubernetes/workload", "Job", "Job"],
    ["/kubernetes/workload", "CronJob", "CronJob"],
    ["/kubernetes/network", "Service", "Service"],
    ["/kubernetes/network", "Ingress", "Ingress"],
    ["/kubernetes/network", "NetworkPolicy", "NetworkPolicy"],
    ["/kubernetes/config", "ConfigMap", "ConfigMap"],
    ["/kubernetes/config", "Secret", "Secret"],
    ["/kubernetes/rbac", "RbacServiceAccount", "ServiceAccount"],
    ["/kubernetes/rbac", "RbacRole", "Role"],
    ["/kubernetes/rbac", "RbacRoleBinding", "RoleBinding"],
    ["/storage", "PersistentVolume", "PersistentVolume"],
    ["/storage", "PersistentVolumeClaim", "PersistentVolumeClaim"],
    ["/security", "KyvernoPolicy", "Policy"],
    ["/security", "KyvernoPolicyReport", "PolicyReport"],
  ];
  for (const [path, kind, label] of features) {
    await page.goto(`${path}?type=${kind}&sort=name&dir=desc&pageSize=25`);
    const link = page
      .getByRole("table")
      .locator("tbody tr")
      .first()
      .getByRole("link")
      .first();
    await expect(link).toBeVisible();
    const name = await link.innerText();
    const list = page.url();
    await link.click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Component features" })
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("tablist", { name: "Resource details" }).getByRole("tab"),
    ).toHaveText(["Overview", "Events", "YAML"]);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText(
      label === "Policy" || label === "PolicyReport"
        ? "Kyverno"
        : label === "Service" ||
            label === "Ingress" ||
            label === "NetworkPolicy"
          ? "Kubernetes Network"
          : kind.startsWith("Rbac")
            ? "RBAC"
            : path === "/storage"
              ? "Volumes"
              : path.endsWith("config")
                ? "Config"
                : "Workloads",
    );
    await page.reload();
    await page.getByRole("link", { name: "Back to list", exact: true }).click();
    await expect(page).toHaveURL(list);
  }
});

test("all Kube-OVN types keep their menu item selected through details and return", async ({
  page,
}) => {
  test.setTimeout(90000);
  const types = [
    ["vpc", "Vpc", "Networks"],
    ["subnet", "Subnet", "Networks"],
    ["ip", "IP", "IP Management"],
    ["ip-pool", "IPPool", "IP Management"],
    ["nat-gateway", "VpcNatGateway", "Gateways & NAT"],
    ["ovn-eip", "OvnEip", "Gateways & NAT"],
    ["ovn-snat", "OvnSnatRule", "Gateways & NAT"],
    ["ovn-dnat", "OvnDnatRule", "Gateways & NAT"],
    ["ovn-fip", "OvnFip", "Gateways & NAT"],
    ["iptables-eip", "IptablesEIP", "Gateways & NAT"],
    ["iptables-snat", "IptablesSnatRule", "Gateways & NAT"],
    ["iptables-dnat", "IptablesDnatRule", "Gateways & NAT"],
    ["iptables-fip", "IptablesFIPRule", "Gateways & NAT"],
    ["provider-network", "ProviderNetwork", "Underlay"],
    ["vlan", "Vlan", "Underlay"],
    ["security-group", "SecurityGroup", "Security"],
  ] as const;
  const menu = page.getByRole("navigation", { name: "Kube-OVN resources" });
  for (const [slug, label, group] of types) {
    await page.goto(`/cni/kube-ovn/resources/${slug}?pageSize=25`);
    await expect(
      page.getByRole("heading", { level: 1, name: label, exact: true }),
    ).toBeVisible();
    const link = page
      .getByRole("table")
      .locator("tbody tr")
      .first()
      .getByRole("link")
      .first();
    await expect(link).toBeVisible();
    const name = await link.innerText();
    const list = page.url();
    await page.goto((await link.getAttribute("href"))!);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbs).toHaveCount(1);
    await expect(breadcrumbs).toContainText(group);
    await page.getByRole("link", { name: "Back to list", exact: true }).click();
    await expect(page).toHaveURL(list);
  }
  await page.goto("/cni/kube-ovn/resources/provider-network");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Resource summary")).toBeVisible();
  await page.screenshot({
    path: "test-results/kube-ovn-desktop.png",
    fullPage: true,
  });
});

test("every overview shares one template with a capped, actionable issue list", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload");
  await expect(
    page.getByRole("heading", { level: 1, name: "Workloads overview" }),
  ).toBeVisible();
  const issues = page.getByRole("region", { name: "Top issues", exact: true });
  await expect(issues.getByRole("listitem")).toHaveCount(8);
  // Progressing resources are counted as rolling out, not listed as issues.
  await expect(issues.getByText("Rolling out revision 2.3.0")).toHaveCount(0);
  await expect(page.getByText(/\d+ rolling out/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "1 Error", exact: true }).first(),
  ).toHaveAttribute("href", /view=resources&status=Error/);
  await page.goto("/cni/kube-ovn");
  await expect(
    page.getByRole("heading", { level: 1, name: "Kube-OVN overview" }),
  ).toBeVisible();
  const networks = page.getByRole("region", { name: "Networks", exact: true });
  await expect(
    networks.getByRole("link", { name: "1 Warning", exact: true }),
  ).toHaveAttribute("href", "/cni/kube-ovn/resources/subnet?status=Warning");
  await expect(
    page.getByRole("region", { name: "Top issues", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Subnet IPv4 capacity" }),
  ).toBeVisible();
  await expect(page.getByRole("meter")).toHaveCount(3);
  // Section cards were replaced by the local menu.
  await expect(page.getByText("VPCs and subnets", { exact: true })).toHaveCount(
    0,
  );
});

test("Summary takes priority over Related for single references", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload?type=Pod");
  await page
    .getByRole("table")
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first()
    .click();
  const summary = page.getByRole("region", { name: "Summary", exact: true });
  await expect(summary.getByRole("link", { name: /^node-\d+$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Node \(/ })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Related resources", exact: true }),
  ).toHaveCount(0);
  await page.goto(
    "/kubernetes/workload/replicaset/default/notification-service-9c4b",
  );
  await expect(
    page
      .getByRole("region", { name: "Summary", exact: true })
      .getByRole("link", { name: "notification-service", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^Deployment \(/ }),
  ).toHaveCount(0);
  await page.goto("/cni/kube-ovn/resources/subnet/_/tenant-a-net");
  await expect(
    page
      .getByRole("region", { name: "Summary", exact: true })
      .getByRole("link", { name: "tenant-a", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /^Vpc \(/ })).toHaveCount(0);
  const other = page.getByRole("region", { name: "Other related (3)" });
  await expect(
    other.getByRole("columnheader", { name: "Kind", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/related-resource-details.png",
    fullPage: true,
  });
});

test("a PersistentVolume shows its claim in Summary and no Related section", async ({
  page,
}) => {
  await page.goto("/storage/persistent-volume/_/pv-mnemo-postgres-0");
  const summary = page.getByRole("region", { name: "Summary", exact: true });
  await expect(summary.getByText("Claim", { exact: true })).toBeVisible();
  await expect(summary.getByRole("link")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Related resources", exact: true }),
  ).toHaveCount(0);
});

test("pagination survives detail refresh and browser back, and sidebar selection is unambiguous", async ({
  page,
}) => {
  await page.goto(
    "/kubernetes/workload?type=Deployment&sort=name&dir=asc&page=2&pageSize=10",
  );
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  const list = page.url();
  const resource = page
    .getByRole("table")
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first();
  const name = await resource.innerText();
  await resource.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Back to list", exact: true }).click();
  await expect(page).toHaveURL(list);
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await resource.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(list);
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.screenshot({
    path: "test-results/resources-desktop.png",
    fullPage: true,
  });
  await page.goto("/storage/rook-ceph");
  await expect(
    page.getByRole("link", { name: "Rook-Ceph", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Volumes", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
});

test("mobile global navigation closes its drawer and the local drawer keeps the selected type", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cni/kube-ovn/resources/vlan");
  await expect(
    page.getByRole("list", { name: "Resource results", exact: true }),
  ).toBeVisible();
  await page.locator('[data-sidebar="trigger"]').click();
  const sidebar = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await expect(sidebar).toBeVisible();
  await sidebar
    .getByRole("link", { name: "Config", exact: true })
    .press("Enter");
  await expect(sidebar).not.toBeVisible();
  await expect(page).toHaveURL(/\/kubernetes\/config$/);
  await page
    .getByRole("button", { name: /Overview.*Component features/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Secret", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: /Secret.*Component features/ }),
  ).toBeVisible();
  await page.goto("/cni/kube-ovn/resources/vlan");
  const trigger = page.getByRole("button", {
    name: /Vlan.*Kube-OVN resources/,
  });
  await expect(trigger).toBeVisible();
  await page.reload();
  await expect(trigger).toBeVisible();
});

test("local menu resizes by keyboard, persists, and resets on double-click", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload?type=Deployment");
  const handle = page.getByRole("separator", {
    name: "Resize component features",
  });
  const menu = page.getByRole("navigation", { name: "Component features" });
  await expect(handle).toHaveAttribute("aria-valuenow", "208");
  await handle.focus();
  await handle.press("ArrowRight");
  await handle.press("Shift+ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "272");
  await expect
    .poll(async () => Math.round((await menu.boundingBox())!.width))
    .toBe(272);
  await page.reload();
  await expect(handle).toHaveAttribute("aria-valuenow", "272");
  await handle.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "360");
  await handle.dblclick();
  await expect(handle).toHaveAttribute("aria-valuenow", "208");
  await page.goto("/kubernetes/config?type=ConfigMap");
  await expect(
    page.getByRole("separator", { name: "Resize component features" }),
  ).toHaveAttribute("aria-valuenow", "208");
});

test("related resources render one card per kind with a distinct header bar", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload/deployment/mnemo-system/mnemo-api");
  const related = page.getByRole("region", {
    name: "Related resources",
    exact: true,
  });
  const pods = related.getByRole("region", { name: /^Pod \(\d+\)$/ });
  await expect(pods).toBeVisible();
  await expect(
    pods.getByRole("button", { name: /^Pod \d+ · Owned by this Deployment/ }),
  ).toHaveAttribute("aria-expanded", "true");
  const table = pods.getByRole("table", { name: "Pod" });
  await expect(
    table.getByRole("columnheader", { name: "Restarts", exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "Status", exact: true }),
  ).toBeVisible();
  const rows = table.getByRole("row");
  await expect(rows.nth(1).getByRole("link")).toHaveCount(1);
  // Every pod shares the Deployment's namespace, so that column is omitted.
  await expect(
    table.getByRole("columnheader", { name: "Namespace", exact: true }),
  ).toHaveCount(0);
});

test("table headers sort through the URL and cycle back to the default", async ({
  page,
}) => {
  await page.goto("/kubernetes/workload?type=Pod");
  const header = page.getByRole("columnheader", { name: "Name", exact: true });
  await expect(header).toHaveAttribute("aria-sort", "none");
  await header.getByRole("button").click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(page).not.toHaveURL(/dir=/);
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(page).toHaveURL(/sort=name&dir=desc|dir=desc.*sort=name/);
  await header.getByRole("button").click();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(header).toHaveAttribute("aria-sort", "none");
});
