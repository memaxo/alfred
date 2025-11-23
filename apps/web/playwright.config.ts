import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.MINDSCAPE_PORT ?? 3100);
const HOST = process.env.MINDSCAPE_HOST ?? "127.0.0.1";
const BASE_URL = process.env.MINDSCAPE_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `bun run dev:test -- --host=${HOST} --port=${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        MINDSCAPE_TEST: "1",
        VITE_TEST_MODE: "true",
        NODE_ENV: process.env.NODE_ENV ?? "test",
      },
    },
  ],
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
