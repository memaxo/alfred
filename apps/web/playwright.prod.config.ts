import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.MINDSCAPE_PORT ?? 3100);
const HOST = process.env.MINDSCAPE_HOST ?? "127.0.0.1";
const BASE_URL = process.env.MINDSCAPE_BASE_URL ?? `http://${HOST}:${PORT}`;
const CWD = dirname(fileURLToPath(import.meta.url));

const shouldStartWebServer =
  process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1" &&
  process.env.CI !== "workflow-test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  outputDir: "./test-results",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: shouldStartWebServer
    ? [
        {
          command: "bun run build && bun dist/server/server.js",
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          cwd: CWD,
          env: {
            MINDSCAPE_TEST: "1",
            VITE_TEST_MODE: "true",
            NODE_ENV: "production",
            HOST,
            PORT: PORT.toString(),
          },
        },
      ]
    : [],
  projects: [
    {
      name: "prod-smoke",
      testMatch: /\.prod\.smoke\.spec\.ts$/,
      use: devices["Desktop Chrome"],
    },
  ],
});
