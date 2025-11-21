import { describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  startLearningWorker,
  stopLearningWorker,
} from "../src/orchestrator/learning-worker";

// Mock extraction to avoid NLU overhead in integration test
mock.module("@alfred/knowledge/extractor", () => ({
  extract: async () => ({
    facts: [
      {
        content: "Test Fact",
        confidence: 1.0,
        source: "test",
        entities: [],
        relations: [],
        topics: [],
      },
    ],
    causality: [],
    entities: new Set(),
    contradictions: [],
    topics: [],
  }),
  toKnowledge: () => [
    {
      hash: "hash-123",
      data: {
        _: "fact",
        content: "Test Fact",
        confidence: 1.0,
        source: "test",
      },
      topics: [],
    },
  ],
}));

// Mock DB writes to avoid pollution (or use test DB if configured)
// Since this is an integration test, using real DB might be better IF we have a test DB.
// However, without a clean teardown, we risk side effects.
// Let's assume we are running against a test database or we mock the DB interactions.
// Given the context of previous tests, let's mock the DB calls to control the flow.

const mockRunId = randomUUID();
const mockRuns = [
  {
    id: mockRunId,
    userId: "user-1",
    workflowId: "test-flow",
    status: "completed",
    inputData: { prompt: "hello" },
    stateData: { result: "world" },
    completedAt: new Date(),
    learnedAt: null,
  },
];

mock.module("@alfred/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => mockRuns,
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          mockRuns[0].learnedAt = new Date(); // Update mock state
        },
      }),
    }),
  },
  workflowRuns: {
    status: { name: "status" },
    learnedAt: { name: "learnedAt" },
    completedAt: { name: "completedAt" },
    id: { name: "id" },
  },
}));

mock.module("@alfred/db/repo/graph", () => ({
  upsertNodes: async () => ({ "user:hash-123": { id: "node-1" } }),
  upsertEdges: async () => {},
}));

describe("Learning Worker Integration", () => {
  test("worker picks up unlearned run and marks it learned", async () => {
    // Start worker with fast polling
    startLearningWorker({ intervalMs: 100, batchSize: 1 });

    // Wait for a cycle
    await new Promise((resolve) => setTimeout(resolve, 200));

    stopLearningWorker();

    // Check if learnedAt was updated
    expect(mockRuns[0].learnedAt).not.toBeNull();
  });
});
