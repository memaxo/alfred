import { describe, expect, it } from "bun:test";

describe("workflow.streamPipeline rate limit", () => {
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
      consumeRouteRateLimit("workflow.streamPipeline", "sess-1");
      consumeRouteRateLimit("workflow.streamPipeline", "sess-1");
      consumeRouteRateLimit("workflow.streamPipeline", "sess-1");
    } catch (error) {
      msg = error instanceof Error ? error.message : String(error);
    }

    expect(msg).toContain("rate_limited");

    if (typeof prevLimit === "string") {
      process.env.ROUTE_RATE_LIMIT_PER_MINUTE = prevLimit;
    } else {
      Reflect.deleteProperty(process.env, "ROUTE_RATE_LIMIT_PER_MINUTE");
    }
  });
});
