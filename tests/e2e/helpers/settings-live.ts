import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import https from "node:https";
import http from "node:http";

const root = process.env.MNEMO_LIVE_TEST_DIR ?? "/tmp/mnemo-server-test";
const baseURL = process.env.MNEMO_LIVE_BASE_URL ?? "https://localhost:3443";

type Result = { status: number; body: string; cookies: string[] };
export async function request(
  method: string,
  path: string,
  body?: unknown,
  role = "admin",
  csrf?: { token: string; cookie: string },
): Promise<Result> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const plain = baseURL.startsWith("http:");
    const transport = plain ? http : https;
    const call = transport.request(
      new URL(path, baseURL),
      {
        method,
        ...(plain
          ? {}
          : {
              ca: readFileSync(`${root}/ca.crt`),
              ...(role === "anonymous"
                ? {}
                : {
                    cert: readFileSync(`${root}/${role}.crt`),
                    key: readFileSync(`${root}/${role}.key`),
                  }),
            }),
        headers: {
          "Content-Type": "application/json",
          ...(plain &&
          role !== "anonymous" &&
          process.env.MNEMO_HTTP_NO_AUTH !== "true"
            ? {
                Authorization:
                  "Basic " +
                  Buffer.from(
                    `${role === "reader" ? "viewer" : role}:${readFileSync(`${root}/http-${role === "reader" ? "viewer" : "admin"}-password`, "utf8").trim()}`,
                  ).toString("base64"),
              }
            : {}),
          ...(payload === undefined
            ? {}
            : { "Content-Length": Buffer.byteLength(payload) }),
          ...(csrf ? { "X-CSRF-Token": csrf.token, Cookie: csrf.cookie } : {}),
        },
        timeout: 15000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
            cookies: response.headers["set-cookie"] ?? [],
          }),
        );
      },
    );
    call.on("error", () =>
      reject(new Error("Live HTTPS API request failed (details redacted)")),
    );
    call.on("timeout", () => call.destroy(new Error("timeout")));
    call.end(payload);
  });
}
async function mutate(
  method: string,
  path: string,
  body?: unknown,
  role = "admin",
) {
  const session = await request("GET", "/api/v1/session", undefined, role);
  const token = JSON.parse(session.body).csrfToken as string;
  return request(method, path, body, role, {
    token,
    cookie: session.cookies.map((value) => value.split(";")[0]).join("; "),
  });
}
async function enterDocument(page: Page, document: string) {
  const textarea = page.getByRole("textbox", { name: "Kubeconfig" });
  // Real kubeconfigs must not appear in Playwright fill call logs or traces.
  await textarea.evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, document);
}

export function registerLiveSettingsTests() {
  test.describe("Settings against the real Go server and Kubernetes", () => {
    test.describe.configure({ mode: "serial" });
    const document = readFileSync(`${root}/cluster.json`, "utf8");
    const config = JSON.parse(document);
    const context = config["current-context"] as string;
    const selected = config.contexts.find(
      (entry: { name: string }) => entry.name === context,
    );
    const submission = { kubeconfig: document, context };
    const credentials = config.users.flatMap(
      (entry: { user: Record<string, unknown> }) =>
        Object.entries(entry.user)
          .filter(
            ([key, value]) =>
              [
                "token",
                "password",
                "client-key-data",
                "client-certificate-data",
              ].includes(key) && typeof value === "string",
          )
          .map(([, value]) => value as string),
    );

    test.beforeAll(async () => {
      const current = await request("GET", "/api/v1/cluster/connection");
      expect(current.status).toBe(200);
      if (!JSON.parse(current.body).configured)
        expect(
          (await mutate("PUT", "/api/v1/cluster/kubeconfig", submission))
            .status,
        ).toBe(200);
    });

    test("shows the real cluster and rejects invalid YAML in review", async ({
      page,
    }) => {
      await page.goto("/settings");
      await expect(
        page
          .getByRole("region", { name: "Cluster connection" })
          .getByText(context, { exact: true })
          .first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Replace kubeconfig" }).click();
      await page
        .getByRole("textbox", { name: "Kubeconfig" })
        .fill("clusters: [unclosed");
      await expect(
        page.getByRole("list", { name: "Kubeconfig checks" }),
      ).toContainText("This is not valid YAML");
      await expect(
        page.getByRole("button", { name: "Replace connection" }),
      ).toBeDisabled();
    });

    test("validates, persists across reload, disconnects and reconnects without browser credential storage", async ({
      page,
    }) => {
      const responses: string[] = [];
      page.on("response", async (response) => {
        if (
          response.url().includes("/api/v1/cluster/") &&
          response.status() !== 204
        )
          responses.push(await response.text().catch(() => ""));
      });
      await page.goto("/settings");
      await page.getByRole("button", { name: "Replace kubeconfig" }).click();
      await enterDocument(page, document);
      await page
        .getByRole("region", { name: "Verify and save" })
        .getByRole("button", { name: "Test connection" })
        .click();
      await expect(
        page.getByRole("list", { name: "Server checks" }),
      ).toContainText("Cluster version probe succeeded.");
      await page.getByRole("button", { name: "Replace connection" }).click();
      await expect(
        page.getByRole("textbox", { name: "Kubeconfig" }),
      ).toHaveCount(0);
      await page.reload();
      await expect(
        page
          .getByRole("region", { name: "Cluster connection" })
          .getByText(context, { exact: true })
          .first(),
      ).toBeVisible();
      const storage = await page.evaluate(
        () =>
          JSON.stringify({ ...localStorage }) +
          JSON.stringify({ ...sessionStorage }),
      );
      expect(
        credentials.some((secret: string) => storage.includes(secret)),
      ).toBe(false);
      expect(
        responses.some((response) =>
          credentials.some((secret: string) => response.includes(secret)),
        ),
      ).toBe(false);
      expect(storage.includes("apiVersion")).toBe(false);
      await page
        .getByRole("button", { name: "Disconnect", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm disconnect" }).click();
      await expect(
        page.getByText("Not configured", { exact: true }),
      ).toBeVisible();
      expect((await request("GET", "/api/v1/pods")).status).toBe(409);
      await page.getByRole("link", { name: "Workloads", exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "No cluster connected." }),
      ).toBeVisible();
      await page.goto("/settings");
      await enterDocument(page, document);
      await page.getByRole("button", { name: "Save connection" }).click();
      await expect(
        page.getByRole("textbox", { name: "Kubeconfig" }),
      ).toHaveCount(0);
      await page.reload();
      await expect(
        page
          .getByRole("region", { name: "Cluster connection" })
          .getByText(context, { exact: true })
          .first(),
      ).toBeVisible();
    });

    test("reader certificate sees status but cannot edit or invoke write endpoints", async ({
      browser,
    }) => {
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
          page
            .getByRole("region", { name: "Cluster connection" })
            .getByText(context, { exact: true })
            .first(),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Replace kubeconfig" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Disconnect", exact: true }),
        ).toHaveCount(0);
        for (const [method, path] of [
          ["PUT", "/api/v1/cluster/kubeconfig"],
          ["DELETE", "/api/v1/cluster/kubeconfig"],
          ["POST", "/api/v1/cluster/kubeconfig/validate"],
          ["POST", "/api/v1/cluster/connection/test"],
        ]) {
          const response = await request(method, path, {}, "reader");
          expect(response.status).toBe(403);
          expect(JSON.parse(response.body).reason).toBe("forbidden");
        }
      } finally {
        await reader.close();
      }
    });

    test("unreachable replacement preserves the stored connection", async ({
      page,
    }) => {
      const unreachable = structuredClone(config);
      unreachable.clusters.find(
        (entry: { name: string }) => entry.name === selected.context.cluster,
      ).cluster.server = "https://127.0.0.1:1";
      await page.goto("/settings");
      await page.getByRole("button", { name: "Replace kubeconfig" }).click();
      await enterDocument(page, JSON.stringify(unreachable));
      await page
        .getByRole("region", { name: "Verify and save" })
        .getByRole("button", { name: "Test connection" })
        .click();
      await expect(
        page.getByRole("list", { name: "Server checks" }),
      ).toContainText("Cluster could not be reached from the server.");
      await page.getByRole("button", { name: "Replace connection" }).click();
      await expect(
        page.getByText("The cluster could not be reached from the server.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        JSON.parse((await request("GET", "/api/v1/cluster/connection")).body)
          .context,
      ).toBe(context);
    });

    test("real projections serve Kubernetes, Kube-OVN and relationship views", async ({
      page,
    }) => {
      await expect
        .poll(async () => (await request("GET", "/api/v1/nodes")).status)
        .toBe(200);
      const nodes = JSON.parse((await request("GET", "/api/v1/nodes")).body);
      expect(nodes.total).toBeGreaterThan(0);
      expect(nodes.items[0].kind).toBe("Node");
      expect(nodes.items[0].metadata.namespace).toBeUndefined();
      await page.goto("/kubernetes/node");
      await expect(
        page.getByText(nodes.items[0].metadata.name, { exact: true }).first(),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            (await request("GET", "/api/v1/integrations/kube-ovn/capabilities"))
              .status,
        )
        .toBe(200);
      const capabilities = JSON.parse(
        (await request("GET", "/api/v1/integrations/kube-ovn/capabilities"))
          .body,
      );
      expect(capabilities.installed).toBe(true);
      await expect
        .poll(async () => (await request("GET", "/api/v1/kube-ovn/vpc")).status)
        .toBe(200);
      const vpcs = JSON.parse(
        (await request("GET", "/api/v1/kube-ovn/vpc")).body,
      );
      expect(vpcs.total).toBeGreaterThan(0);
      expect(vpcs.items[0].kind).toBe("KubeOvnVpc");
      const relations = await request("GET", "/api/v1/relations");
      expect(relations.status).toBe(200);
      expect(JSON.parse(relations.body).semantics).toBe("configuration");
      expect(JSON.parse(relations.body).total).toBeGreaterThan(0);
      await expect
        .poll(
          async () =>
            (
              await request(
                "GET",
                `/api/v1/nodes/_/${encodeURIComponent(nodes.items[0].metadata.name)}/events`,
              )
            ).status,
        )
        .toBe(200);
      const nodeEvents = await request(
        "GET",
        `/api/v1/nodes/_/${encodeURIComponent(nodes.items[0].metadata.name)}/events`,
      );
      expect(nodeEvents.status).toBe(200);
      await expect
        .poll(async () => (await request("GET", "/api/v1/secrets")).status)
        .toBe(200);
      const secrets = await request("GET", "/api/v1/secrets");
      expect(secrets.status).toBe(200);
      expect(
        JSON.parse(secrets.body).items.every(
          (item: { spec: { keysAvailable: boolean } }) =>
            item.spec.keysAvailable === false,
        ),
      ).toBe(true);
    });

    test("SSE flushes committed refreshes and refetches on reconnect", async () => {
      const frames = (needed: number) =>
        new Promise<void>((resolve, reject) => {
          let buffer = "",
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
                response.destroy();
                reject(new Error("SSE request rejected"));
                return;
              }
              response.on("data", (chunk: Buffer) => {
                buffer += chunk.toString();
                let split: number;
                while ((split = buffer.indexOf("\n\n")) >= 0) {
                  const frame = buffer.slice(0, split);
                  buffer = buffer.slice(split + 2);
                  if (frame.startsWith("event: refresh")) count++;
                  if (count >= needed) {
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
            reject(new Error("SSE refresh timed out"));
          }, 45000);
          stream.on("error", () => {
            if (!finished) {
              clearTimeout(timer);
              reject(new Error("SSE transport failed (redacted)"));
            }
          });
        });
      await frames(2);
      await frames(1);
    });

    test("dashboard authentication and CSRF are enforced", async () => {
      expect(
        (await request("GET", "/settings", undefined, "anonymous")).status,
      ).toBe(401);
      expect(
        (await request("DELETE", "/api/v1/cluster/kubeconfig")).status,
      ).toBe(403);
      expect((await request("GET", "/api/v1/cluster/connection")).status).toBe(
        200,
      );
    });
  });
}
