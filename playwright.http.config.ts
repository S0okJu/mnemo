import { defineConfig } from "@playwright/test";
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "settings.spec.ts",
  timeout: 60000,
  expect: { timeout: 20000 },
  workers: 1,
  outputDir: "test-results/http-deployed",
  use: {
    baseURL: process.env.MNEMO_LIVE_BASE_URL ?? "http://192.168.50.138:30080",
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
