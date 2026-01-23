import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.MINDSCAPE_PORT ?? 3100);
const HOST = process.env.MINDSCAPE_HOST ?? "127.0.0.1";
const BASE_URL = process.env.MINDSCAPE_BASE_URL ?? `http://${HOST}:${PORT}`;
const shouldStartWebServer =
  process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1" &&
  process.env.CI !== "workflow-test";

// Screenshot configuration
const CAPTURE_SCREENSHOTS = process.env.PLAYWRIGHT_SCREENSHOTS === "1";

// AI-optimized mode configuration (default: enabled)
const AI_MODE = process.env.PLAYWRIGHT_AI_MODE !== "0";
const FAIL_FAST = process.env.PLAYWRIGHT_FAIL_FAST !== "0";

export default defineConfig({
  testDir: "./.tests",
  timeout: AI_MODE ? 60_000 : 120_000,
  expect: {
    timeout: AI_MODE ? 10_000 : 15_000,
    // Visual comparison thresholds
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.05,
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },
  // Output configuration for screenshots and reports
  outputDir: "./test-results",
  snapshotDir: "./test-snapshots",
  fullyParallel: !FAIL_FAST,
  retries: FAIL_FAST ? 0 : process.env.CI ? 1 : 0,
  workers: FAIL_FAST ? 1 : process.env.CI ? 2 : undefined,
  maxFailures: FAIL_FAST ? 1 : undefined,
  // Reporter configuration for comprehensive analysis
  reporter: AI_MODE
    ? [
        ["dot"],
        ["./.tests/reporters/ai-compact-reporter.ts"],
        ["json", { outputFile: "./test-results/results.json" }],
      ]
    : [
        ["list"],
        // Playwright requires the HTML report folder to be outside `outputDir`.
        ["html", { outputFolder: "./playwright-report", open: "never" }],
        ["json", { outputFile: "./test-results/results.json" }],
      ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    // Enhanced screenshot configuration
    screenshot: CAPTURE_SCREENSHOTS ? "on" : "only-on-failure",
    viewport: { width: 1440, height: 900 },
    // Animation handling for consistent screenshots
    launchOptions: {
      slowMo: process.env.PLAYWRIGHT_SLOW_MO
        ? Number(process.env.PLAYWRIGHT_SLOW_MO)
        : undefined,
    },
  },
  webServer: shouldStartWebServer
    ? [
        {
          command: `bun run dev:test -- --host=${HOST} --port=${PORT}`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            MINDSCAPE_TEST: "1",
            VITE_TEST_MODE: "true",
            PLAYWRIGHT_REAL_AUTH: process.env.PLAYWRIGHT_REAL_AUTH ?? "0",
            VITE_PLAYWRIGHT_REAL_AUTH:
              process.env.PLAYWRIGHT_REAL_AUTH === "1" ? "1" : "0",
            NODE_ENV: process.env.NODE_ENV ?? "test",
          },
        },
      ]
    : [],
  projects: [
    {
      name: "smoke",
      testMatch: /\.smoke\.spec\.ts$/,
      use: devices["Desktop Chrome"],
    },
    {
      name: "integration",
      testMatch: /\.integration\.spec\.ts$/,
      use: devices["Desktop Chrome"],
    },
    {
      name: "e2e",
      testMatch: /\.e2e\.spec\.ts$/,
      use: devices["Desktop Chrome"],
    },
  ],
});
