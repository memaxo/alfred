import { describe, expect, it } from "bun:test";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

describe("metrics router", () => {
  it("requires auth", async () => {
    const unauthed = await createUnauthedCaller();
    await expect(
      unauthed.metrics.estimateCost({
        modelId: "cerebras/llama3.1-8b",
        usage: { inputTokens: 1, outputTokens: 1 },
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("estimates Cerebras cost using ALFRED pricing registry", async () => {
    const caller = await createTestCaller();

    const res = await caller.metrics.estimateCost({
      modelId: "cerebras/llama3.1-8b",
      usage: { inputTokens: 100_000, outputTokens: 50_000 },
    });

    expect(res.modelKey).toBe("cerebras/llama3.1-8b");
    expect(res.provider).toBe("cerebras");
    expect(res.modelId).toBe("llama3.1-8b");
    expect(res.pricing).toEqual({
      promptCostPer1M: 0.1,
      completionCostPer1M: 0.1,
    });
    // (100k + 50k) / 1M * 0.1 = 0.015
    expect(res.costUsd.totalUsd).toBeCloseTo(0.015, 5);
  });

  it("accepts provider:modelId and normalizes it", async () => {
    const caller = await createTestCaller();

    const res = await caller.metrics.estimateCost({
      modelId: "cerebras:llama3.1-8b",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    expect(res.modelKey).toBe("cerebras/llama3.1-8b");
  });
});
