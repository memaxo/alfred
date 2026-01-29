import { describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");

const generateObjectMock = vi.fn(async (args: any) => ({
  object: {
    friction: [
      {
        type: "rephrasing_cascade",
        severity: "high",
        timing: "lagging",
        confidence: 0.9,
        stepNumber: 3,
        description: "User rephrased multiple times.",
        citations: ["user restated goal repeatedly"],
        detectedAt: 1,
        metadata: {},
      },
    ],
    delight: [],
    interventions: [
      {
        action: "clarify",
        timing: "immediate",
        message: "Ask a clarifying question about the goal.",
        confidence: 0.8,
        decidedAt: 2,
        metadata: {},
      },
    ],
  },
}));

mock.module("ai", () => ({
  ...realAi,
  generateObject: generateObjectMock,
}));

describe("signals judge", () => {
  it("returns structured judge output", async () => {
    const { judgeSignals } = await import("../src/signals/judge");

    const out = await judgeSignals(
      { trace: { stepNumber: 3, events: [{ type: "tool-call" }] } },
      { model: {} as any }
    );

    expect(out.friction[0]?.type).toBe("rephrasing_cascade");
    expect(out.interventions[0]?.action).toBe("clarify");
    expect(generateObjectMock).toHaveBeenCalled();
  });
});
