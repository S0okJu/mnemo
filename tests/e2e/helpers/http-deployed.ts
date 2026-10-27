import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import http from "node:http";
import { request as api } from "./settings-live";
const root = process.env.MNEMO_LIVE_TEST_DIR ?? "/tmp/mnemo-test-deploy";
const baseURL =
  process.env.MNEMO_LIVE_BASE_URL ?? "http://192.168.50.138:30080";
export function registerHTTPDeploymentTests() {
  test.describe("HTTP Helm deployment on 192.168.50.138", () => {
    test("HTTP frontend opens without an account and CSRF-protected connection testing works", async ({
      page,
    }) => {
      expect((await api("GET", "/readyz")).status).toBe(200);
      await expect
        .poll(async () => {
          const response = await api("GET", "/api/v1/deployments");
          if (response.status !== 200) return -1;
          return JSON.parse(response.body).items.filter(
            (item: { status: { level: string } }) =>
              item.status.level === "Unknown",
          ).length;
        })
        .toBe(0);
      await page.goto("/");
      await expect(page).toHaveURL(/\/kubernetes\/workload/);
      await expect(
        page.getByRole("link", { name: "Settings", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => page.getByText("All healthy", { exact: true }).count())
        .toBeGreaterThanOrEqual(3);
      await page.screenshot({
        path: `${root}/deployed-http-frontend.png`,
        fullPage: true,
      });
      await page.goto("/settings");
      expect(new URL(page.url()).protocol).toBe("http:");
      await expect(
        page
          .getByRole("region", { name: "Cluster connection" })
          .getByText("Connected", { exact: true }),
      ).toBeVisible();
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/v1/cluster/connection/test") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Test connection", exact: true })
        .click();
      expect((await response).status()).toBe(200);
      const metadata = JSON.parse(
        (await api("GET", "/api/v1/cluster/connection")).body,
      );
      expect(metadata.status).toBe("connected");
      expect(metadata.source).toBe("in-cluster");
      await page.screenshot({
        path: `${root}/deployed-http-settings.png`,
        fullPage: true,
      });
    });
    test("HTTP serves actual target-cluster resources and Kube-OVN projections", async ({
      page,
    }) => {
      await expect
        .poll(async () => (await api("GET", "/api/v1/nodes")).status)
        .toBe(200);
      const nodes = JSON.parse((await api("GET", "/api/v1/nodes")).body);
      const uid = readFileSync(`${root}/expected-node-uid`, "utf8").trim();
      const target = nodes.items.find(
        (n: { metadata: { uid: string } }) => n.metadata.uid === uid,
      );
      expect(Boolean(target)).toBe(true);
      await page.goto("/kubernetes/node");
      await page
        .getByText(target.metadata.name, { exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/kubernetes/node/_/${target.metadata.name}`),
      );
      const vpcs = await api("GET", "/api/v1/kube-ovn/vpc");
      expect(vpcs.status).toBe(200);
      expect(JSON.parse(vpcs.body).total).toBeGreaterThan(0);
      const relations = await api("GET", "/api/v1/relations");
      expect(relations.status).toBe(200);
      expect(JSON.parse(relations.body).total).toBeGreaterThan(0);
    });
    test("test HTTP needs no login and still requires a CSRF token for writes", async ({
      browser,
    }) => {
      expect(
        (await api("GET", "/settings", undefined, "anonymous")).status,
      ).toBe(200);
      expect(
        (await api("POST", "/api/v1/cluster/connection/test", {})).status,
      ).toBe(403);
      const session = await api(
        "GET",
        "/api/v1/session",
        undefined,
        "anonymous",
      );
      expect(session.status).toBe(200);
      expect(
        session.cookies.some(
          (c) =>
            c.startsWith("mnemo-csrf=") &&
            c.includes("HttpOnly") &&
            !c.includes("Secure"),
        ),
      ).toBe(true);
      const fresh = await browser.newContext({ baseURL });
      try {
        const page = await fresh.newPage();
        await page.goto("/");
        await expect(page).toHaveURL(/\/kubernetes\/workload/);
        await expect(
          page.getByRole("link", { name: "Settings", exact: true }),
        ).toBeVisible();
      } finally {
        await fresh.close();
      }
    });
    test("HTTP SSE flushes remote committed changes and reconnects", async () => {
      const headers = {};
      const frames = (needed: number) =>
        new Promise<void>((resolve, reject) => {
          let buffer = "",
            count = 0,
            finished = false;
          const call = http.get(
            new URL("/api/v1/events", baseURL),
            { headers },
            (response) => {
              if (response.statusCode !== 200) {
                finished = true;
                clearTimeout(timer);
                response.destroy();
                reject(new Error("HTTP SSE rejected"));
                return;
              }
              response.on("data", (chunk: Buffer) => {
                buffer += chunk.toString();
                let end: number;
                while ((end = buffer.indexOf("\n\n")) >= 0) {
                  const frame = buffer.slice(0, end);
                  buffer = buffer.slice(end + 2);
                  if (frame.startsWith("event: refresh")) count++;
                  if (count >= needed) {
                    finished = true;
                    clearTimeout(timer);
                    response.destroy();
                    call.destroy();
                    resolve();
                    return;
                  }
                }
              });
            },
          );
          const timer = setTimeout(() => {
            finished = true;
            call.destroy();
            reject(new Error("HTTP SSE timeout"));
          }, 45000);
          call.on("error", () => {
            if (!finished) {
              clearTimeout(timer);
              reject(new Error("HTTP SSE transport failed"));
            }
          });
        });
      await frames(2);
      await frames(1);
    });
  });
}
