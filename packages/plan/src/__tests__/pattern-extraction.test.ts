import { describe, expect, it, mock } from "bun:test";

import type { StructuredPlan } from "../generate/types.js";

import { extractPatternFromRun } from "../pattern/extract.js";

// Mock AI and DB
mock.module("ai", () => ({
  generateText: async () => ({ text: "add-ui-feature" }),
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
    createPattern: async (data: any) => ({ ...data, id: "pattern-123" }),
  },
}));

mock.module("@alfred/db/repo/graph/write", () => ({
  ensureMirrorNodes: async () => ({}),
}));

describe("Pattern Extraction", () => {
  const mockPlan: StructuredPlan = {
    id: "plan-123",
    title: "Test Plan",
    intent: "Add a dark mode toggle",
    phases: [],
    resources: {
      agentCount: 1,
      strategy: "parallel",
      isolation: "agentfs",
    },
    evaluationCriteria: [],
  };

  const mockRun = {
    id: "run-123",
    userId: "user-123",
    status: "completed",
    projectId: "proj-123",
    created: new Date(Date.now() - 10_000),
    completedAt: new Date(),
  };

  it("should extract pattern from successful run", async () => {
    const pattern = await extractPatternFromRun(mockRun, mockPlan);

    expect(pattern.trigger).toBe("add-ui-feature");
    expect(pattern.successRate).toBe("1.0000");
    expect(pattern.avgDurationMs).toBeGreaterThan(0);
    expect(pattern.projectId).toBe("proj-123");
  });
});
