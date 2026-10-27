import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import https from "node:https";
import { request as api } from "./settings-live";

const root = process.env.MNEMO_LIVE_TEST_DIR ?? "/tmp/mnemo-test-deploy";
const baseURL =
  process.env.MNEMO_LIVE_BASE_URL ?? "https://192.168.50.138:30443";

export function registerDeploymentTests() {
  test.describe("Helm deployment on the real test server", () => {
    test("remote HTTPS serves the in-cluster connection and read-only Settings", async ({
      page,
    }) => {
      expect((await api("GET", "/readyz")).status).toBe(200);
      const connection = await api("GET", "/api/v1/cluster/connection");
      expect(connection.status).toBe(200);
      const metadata = JSON.parse(connection.body);
      expect(metadata.source).toBe("in-cluster");
      expect(metadata.configured).toBe(true);
      expect(metadata.status).toBe("connected");
      await page.goto("/settings");
      const section = page.getByRole("region", { name: "Cluster connection" });
      await expect(
        section.getByText("Connected", { exact: true }),
      ).toBeVisible();
      await expect(
        section.getByText("In-cluster service account", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Replace kubeconfig" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Disconnect", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Test connection", exact: true })
        .click();
      await expect(
        section.getByText("Connected", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${root}/deployed-settings.png`,
        fullPage: true,
      });
    });
    test("deployed projections match the target node and show Kubernetes and Kube-OVN data", async ({
      page,
    }) => {
      await expect
        .poll(async () => (await api("GET", "/api/v1/nodes")).status)
        .toBe(200);
      const nodes = JSON.parse((await api("GET", "/api/v1/nodes")).body);
      expect(nodes.total).toBeGreaterThan(0);
      const expectedUID = readFileSync(
        `${root}/expected-node-uid`,
        "utf8",
      ).trim();
      expect(
        nodes.items.some(
          (node: { metadata: { uid: string } }) =>
            node.metadata.uid === expectedUID,
        ),
      ).toBe(true);
      await page.goto("/kubernetes/node");
      const target = nodes.items.find(
        (node: { metadata: { uid: string } }) =>
          node.metadata.uid === expectedUID,
      );
      await expect(
        page.getByText(target.metadata.name, { exact: true }).first(),
      ).toBeVisible();
      await page
        .getByText(target.metadata.name, { exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/kubernetes/node/_/${target.metadata.name}`),
      );
      await expect(
        page.getByRole("heading", { name: target.metadata.name, exact: true }),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            (await api("GET", "/api/v1/integrations/kube-ovn/capabilities"))
              .status,
        )
        .toBe(200);
      const capabilities = JSON.parse(
        (await api("GET", "/api/v1/integrations/kube-ovn/capabilities")).body,
      );
      expect(capabilities.installed).toBe(true);
      const vpcs = await api("GET", "/api/v1/kube-ovn/vpc");
      expect(vpcs.status).toBe(200);
      expect(JSON.parse(vpcs.body).total).toBeGreaterThan(0);
      const subnets = await api("GET", "/api/v1/kube-ovn/subnet");
      expect(subnets.status).toBe(200);
      expect(JSON.parse(subnets.body).total).toBeGreaterThan(0);
      const relations = await api("GET", "/api/v1/relations");
      expect(relations.status).toBe(200);
      expect(JSON.parse(relations.body).total).toBeGreaterThan(0);
      const secrets = await api("GET", "/api/v1/secrets");
      expect(secrets.status).toBe(200);
      expect(
        JSON.parse(secrets.body).items.every(
          (item: { spec: { keysAvailable: boolean } }) =>
            item.spec.keysAvailable === false,
        ),
      ).toBe(true);
    });
    test("remote dashboard authentication, reader role and CSRF remain enforced", async ({
      browser,
    }) => {
      expect(
        (await api("GET", "/settings", undefined, "anonymous")).status,
      ).toBe(401);
      expect((await api("DELETE", "/api/v1/cluster/kubeconfig")).status).toBe(
        403,
      );
      const reader = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        clientCertificates: [
          {
            origin: baseURL,
            certPath: `${root}/reader.crt`,
            keyPath: `${root}/reader.key`,
          },
        ],
      });
      try {
        const page = await reader.newPage();
        await page.goto("/settings");
        await expect(
          page.getByText("In-cluster service account", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Test connection", exact: true }),
        ).toHaveCount(0);
      } finally {
        await reader.close();
      }
      const denied = await api(
        "POST",
        "/api/v1/cluster/connection/test",
        {},
        "reader",
      );
      expect(denied.status).toBe(403);
      expect(JSON.parse(denied.body).reason).toBe("forbidden");
    });
    test("SSE flushes through the remote endpoint and reconnects", async () => {
      const frames = (required: number) =>
        new Promise<void>((resolve, reject) => {
          let pending = "",
            count = 0,
            finished = false;
          const stream = https.get(
            new URL("/api/v1/events", baseURL),
            {
              ca: readFileSync(`${root}/ca.crt`),
              cert: readFileSync(`${root}/admin.crt`),
              key: readFileSync(`${root}/admin.key`),
            },
            (response) => {
              if (response.statusCode !== 200) {
                finished = true;
                clearTimeout(timer);
                response.destroy();
                reject(new Error("Remote SSE rejected"));
                return;
              }
              response.on("data", (chunk: Buffer) => {
                pending += chunk.toString();
                let split: number;
                while ((split = pending.indexOf("\n\n")) >= 0) {
                  const frame = pending.slice(0, split);
                  pending = pending.slice(split + 2);
                  if (frame.startsWith("event: refresh")) count++;
                  if (count >= required) {
                    finished = true;
                    clearTimeout(timer);
                    response.destroy();
                    stream.destroy();
                    resolve();
                    return;
                  }
                }
              });
            },
          );
          const timer = setTimeout(() => {
            finished = true;
            stream.destroy();
            reject(new Error("Remote SSE refresh timed out"));
          }, 45000);
          stream.on("error", () => {
            if (!finished) {
              clearTimeout(timer);
              reject(
                new Error("Remote SSE transport failed (details redacted)"),
              );
            }
          });
        });
      await frames(2);
      await frames(1);
    });
  });
}
