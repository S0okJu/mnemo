import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: process.env.MNEMO_TEST_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
  webServer: {
    command: "pnpm dev --hostname localhost",
    url: process.env.MNEMO_TEST_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
