import { registerHTTPDeploymentTests } from "./helpers/http-deployed";
import { registerDeploymentTests } from "./helpers/deployment-live";
import { registerLiveSettingsTests } from "./helpers/settings-live";
import { test, expect, type Page } from "@playwright/test";

const SECRET = "super-secret-token-123";
const KUBECONFIG = `apiVersion: v1
kind: Config
current-context: prod
clusters:
- name: prod
  cluster:
    server: https://prod.example.com:6443
    certificate-authority-data: LS0tQ0VSVA==
- name: staging
  cluster:
    server: https://staging.example.com:6443
    insecure-skip-tls-verify: true
users:
- name: prod-admin
  user:
    token: ${SECRET}
- name: sso
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1
      command: kubelogin
contexts:
- name: prod
  context: { cluster: prod, user: prod-admin, namespace: platform }
- name: staging-sso
  context: { cluster: staging, user: sso }
`;

async function openReplaceForm(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Replace kubeconfig" }).click();
  return page.getByRole("textbox", { name: "Kubeconfig" });
}

if (process.env.MNEMO_HTTP_E2E === "true") {
  registerHTTPDeploymentTests();
} else if (process.env.MNEMO_DEPLOYED_E2E === "true") {
  registerDeploymentTests();
} else if (process.env.MNEMO_LIVE_E2E === "true") {
  registerLiveSettingsTests();
} else {
  test("the Settings link shows the current connection and the sidebar names the cluster", async ({
    page,
  }) => {
    await page.goto("/kubernetes/workload");
    await expect(page.getByLabel("Cluster: mnemo-demo")).toBeVisible();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    const section = page.getByRole("region", { name: "Cluster connection" });
    await expect(section.getByText("Connected", { exact: true })).toBeVisible();
    await expect(section.getByText("mnemo-demo").first()).toBeVisible();
    await expect(
      section.getByText("https://demo.mnemo.local:6443", { exact: true }),
    ).toBeVisible();
  });

  test("invalid YAML is reported in review and blocks saving", async ({
    page,
  }) => {
    const textarea = await openReplaceForm(page);
    await textarea.fill("clusters: [unclosed");
    await expect(
      page.getByRole("list", { name: "Kubeconfig checks" }),
    ).toContainText("This is not valid YAML");
    await expect(
      page.getByRole("button", { name: "Replace connection" }),
    ).toBeDisabled();
  });

  test("review lists contexts, warns about plugin auth, and never shows secrets", async ({
    page,
  }) => {
    const textarea = await openReplaceForm(page);
    await textarea.fill(KUBECONFIG);
    const review = page.getByRole("region", { name: "Review" });
    await review.getByRole("combobox").selectOption("staging-sso");
    const checks = review.getByRole("list", { name: "Kubeconfig checks" });
    await expect(checks).toContainText("Exec credentials run a plugin");
    await expect(checks).toContainText("TLS verification is disabled");
    await review.getByRole("combobox").selectOption("prod");
    await expect(review.getByText("Bearer token · embedded")).toBeVisible();
    await expect(review.getByText(SECRET)).toHaveCount(0);
  });

  test("testing, saving, and disconnecting update the status, sidebar, and banner", async ({
    page,
  }) => {
    const textarea = await openReplaceForm(page);
    await textarea.fill(KUBECONFIG);
    await page
      .getByRole("region", { name: "Verify and save" })
      .getByRole("button", { name: "Test connection" })
      .click();
    const serverChecks = page.getByRole("list", { name: "Server checks" });
    await expect(serverChecks).toContainText(
      "Reached https://prod.example.com:6443",
    );
    await expect(page.getByText("Kubernetes v1.31.2")).toBeVisible();
    await page.getByRole("button", { name: "Replace connection" }).click();
    await expect(page.getByText("Connected to prod.")).toBeVisible();
    await expect(page.getByLabel("Cluster: prod")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Kubeconfig" })).toHaveCount(
      0,
    );
    const storage = await page.evaluate(
      () =>
        JSON.stringify({ ...localStorage }) +
        JSON.stringify({ ...sessionStorage }),
    );
    expect(storage).not.toContain(SECRET);
    expect(storage).not.toContain("apiVersion: v1");

    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page.getByRole("button", { name: "Confirm disconnect" }).click();
    await expect(
      page.getByText("Not configured", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Cluster: No cluster connected"),
    ).toBeVisible();
    // Navigate in-app; a reload would restart the mock server with demo data.
    await page.getByRole("link", { name: "Workloads", exact: true }).click();
    const banner = page
      .getByRole("status")
      .filter({ hasText: "No cluster connected." });
    await expect(banner).toBeVisible();
    await banner.getByRole("link", { name: "Connect a cluster →" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("textbox", { name: "Kubeconfig" }).fill(KUBECONFIG);
    await page.getByRole("button", { name: "Save connection" }).click();
    await expect(page.getByText("Connected to prod.")).toBeVisible();
    await page.getByRole("link", { name: "Workloads", exact: true }).click();
    await expect(page.getByText("No cluster connected.")).toHaveCount(0);
  });

  test("an unreachable server is reported by the connection test and save", async ({
    page,
  }) => {
    const textarea = await openReplaceForm(page);
    await textarea.fill(
      KUBECONFIG.replace("prod.example.com", "unreachable.example.com"),
    );
    await page
      .getByRole("region", { name: "Verify and save" })
      .getByRole("button", { name: "Test connection" })
      .click();
    await expect(
      page.getByRole("list", { name: "Server checks" }),
    ).toContainText("Could not reach");
    await page.getByRole("button", { name: "Replace connection" }).click();
    await expect(
      page.getByText("The cluster could not be reached from the server."),
    ).toBeVisible();
    await expect(page.getByLabel("Cluster: mnemo-demo")).toBeVisible();
  });
}
