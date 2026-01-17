import { describe, expect, it, mock, vi } from "bun:test";

const incMock = vi.fn();
const labelsMock = vi.fn(() => ({ inc: incMock }));

mock.module("@alfred/api/metrics", () => ({
  healthChecksTotal: { labels: labelsMock },
  getMetricsSnapshot: vi.fn(async () => "# mock metrics\n"),
  metricsContentType: "text/plain; version=0.0.4; charset=utf-8",
}));

mock.module("@alfred/auth/redis", () => ({
  isRedisHealthy: vi.fn(async () => false),
}));

mock.module("@alfred/db", () => ({
  db: {
    execute: vi.fn(async () => {}),
  },
}));

mock.module("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

import { Route as MetricsRoute } from "@/routes/api/metrics";
import { Route as HealthzRoute } from "@/routes/healthz";
import { Route as DepsRoute } from "@/routes/healthz/deps";

describe("operational routes caching", () => {
  it("/healthz sets Cache-Control: no-store", async () => {
    const res = await HealthzRoute.options.server?.handlers?.GET?.();
    expect(res).toBeTruthy();
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("/healthz/deps sets Cache-Control: no-store", async () => {
    const res = await DepsRoute.options.server?.handlers?.GET?.();
    expect(res).toBeTruthy();
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("/api/metrics sets Cache-Control: no-store", async () => {
    const res = await MetricsRoute.options.server?.handlers?.GET?.();
    expect(res).toBeTruthy();
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });
});
