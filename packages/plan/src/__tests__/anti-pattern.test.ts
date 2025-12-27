import { describe, expect, it, mock } from "bun:test";
import { extractAntiPatternFromRun } from "../pattern/anti.js";

// Mock AI and DB
mock.module("ai", () => ({
  generateText: async () => ({ text: "fix-bug-failure" }),
}));

mock.module("@alfred/agent/v6", () => ({
  getOpenAI: () => () => ({ chat: () => ({}) }),
  getModelId: () => "gpt-4o-mini",
}));

mock.module("@alfred/rag", () => ({
  embed: async () => new Array(1024).fill(0.1),
}));

mock.module("@alfred/db", () => ({
  patternRepo: {
    createPattern: async (data: any) => ({ ...data, id: "anti-pattern-123" }),
  },
}));

mock.module("@alfred/db/repo/graph/write", () => ({
  ensureMirrorNodes: async () => ({}),
}));

describe("Anti-Pattern Extraction", () => {
  const mockPlan = {
    id: "plan-123",
    intent: "Fix auth bug",
    phases: [],
    resources: {},
    evaluationCriteria: [],
  } as any;

  const mockRun = {
    id: "run-failed",
    userId: "user-123",
    status: "failed",
    created: new Date(),
    completedAt: new Date(),
  } as any;

  it("should extract anti-pattern with failure reason", async () => {
    const pattern = await extractAntiPatternFromRun(
      mockRun,
      mockPlan,
      "Arbiter failed to resolve conflict"
    );

    expect(pattern.trigger).toBe("fix-bug-failure");
    expect(pattern.successRate).toBe("0.0000");
    expect((pattern.planTemplate as any).failureReason).toBe(
      "Arbiter failed to resolve conflict"
    );
  });
});
