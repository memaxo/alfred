import { describe, expect, it } from "bun:test";

describe("workflow.stream rate limit", () => {
  it("enforces per-minute limit for subscription", async () => {
    const prevLimit = process.env.ROUTE_RATE_LIMIT_PER_MINUTE;
    process.env.ROUTE_RATE_LIMIT_PER_MINUTE = "2";

    // Important: import a fresh instance so this test does not pollute the
    // shared module singleton used by other router tests (requestCount/resetTime).
    const trpcUrl = new URL("../src/trpc.ts", import.meta.url);
    const { consumeRouteRateLimit } = await import(
      `${trpcUrl.href}?rateLimitTest=${crypto.randomUUID()}`
    );

    let msg = "";
    try {
      await consumeRouteRateLimit("workflow.stream", "sess-1");
      await consumeRouteRateLimit("workflow.stream", "sess-1");
      await consumeRouteRateLimit("workflow.stream", "sess-1");
    } catch (err) {
      msg = err instanceof Error ? err.message : String(err);
    }

    expect(msg).toContain("rate_limited");

    if (typeof prevLimit === "string") {
      process.env.ROUTE_RATE_LIMIT_PER_MINUTE = prevLimit;
    } else {
      Reflect.deleteProperty(process.env, "ROUTE_RATE_LIMIT_PER_MINUTE");
    }
  });
});
