import { defineConfig } from "@playwright/test";

// Pinned Playwright's failure context otherwise captures textarea values even
// when tracing/screenshots are disabled. Real kubeconfigs must never enter it.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const root = process.env.MNEMO_LIVE_TEST_DIR ?? "/tmp/mnemo-server-test";
const baseURL = process.env.MNEMO_LIVE_BASE_URL ?? "https://localhost:3443";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "settings.spec.ts",
  timeout: 60000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results/live",
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    // Browser trust stores do not include the ephemeral local test CA. The
    // native API client verifies it explicitly; cluster TLS stays verified.
    ignoreHTTPSErrors: true,
    clientCertificates: [
      {
        origin: baseURL,
        certPath: `${root}/admin.crt`,
        keyPath: `${root}/admin.key`,
      },
    ],
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});
