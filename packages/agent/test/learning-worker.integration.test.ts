import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  startLearningWorker,
  stopLearningWorker,
} from "../src/orchestrator/learning-worker";

// Mock extraction to avoid NLU overhead in integration test
mock.module("@alfred/knowledge/extractor", () => ({
  extract: () => ({
    facts: [
      {
        content: "Test Fact",
        confidence: 1.0,
        source: "test",
        entities: [],
        relations: [],
      },
    ],
    entities: new Set(),
    contradictions: [],
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
    },
  ],
}));

mock.module("@alfred/knowledge/reasoning/causality", () => ({
  deriveCausalityFromText: async () => [],
}));

mock.module("@alfred/knowledge/reasoning/decisions", () => ({
  deriveDecisionFacts: async () => [],
}));

mock.module("@alfred/knowledge/reasoning/alternatives", () => ({
  deriveAlternativeFacts: async () => [],
}));

// State for mocks
let mockRuns: any[] = [];
let decayCalled = false;
let pruneCalled = false;
let cleanupCalled = false;
let decayedNodes: any[] = [];
let prunedNodeIds: string[] = [];

const resetMockState = () => {
  mockRuns = [
    {
      id: randomUUID(),
      userId: "user-1",
      workflowId: "test-flow",
      status: "completed",
      inputData: { prompt: "hello" },
      stateData: { result: "world" },
      completedAt: new Date(),
      learnedAt: null,
    },
  ];
  decayCalled = false;
  pruneCalled = false;
  cleanupCalled = false;
  decayedNodes = [];
  prunedNodeIds = [];
};

// Mock DB
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
        where: () => {
          if (mockRuns[0]) {
            mockRuns[0].learnedAt = new Date();
          }
          return Promise.resolve(undefined);
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

// Mock Graph Repo
mock.module("@alfred/db/repo/graph/index", () => ({
  upsertNodes: () =>
    Promise.resolve(new Map([["user:hash-123", { id: "node-1" }]])),
  upsertEdges: () => Promise.resolve([]),

  // Decay mocks
  findNodesForDecay: () =>
    Promise.resolve([{ id: "node-decay-1", properties: { confidence: 1.0 } }]),
  updateNodeConfidenceBatch: (updates: unknown[]) => {
    decayCalled = true;
    decayedNodes = updates as Array<{ id: string; confidence: number }>;
    return Promise.resolve(updates.length);
  },

  // Prune mocks
  findNodesByConfidence: (_min: number, max: number) => {
    // Only return nodes if we are testing pruning (max < 1.0)
    if (max < 0.5) {
      return Promise.resolve([
        { id: "node-prune-1", properties: { confidence: 0.1 } },
      ]);
    }
    return Promise.resolve([]);
  },
  archiveNodes: (ids: string[]) => {
    pruneCalled = true;
    prunedNodeIds = ids;
    return Promise.resolve(ids.length);
  },

  // Cleanup mocks
  deleteArchivedNodes: () => {
    cleanupCalled = true;
    return Promise.resolve(1);
  },
}));

// Mock Ontology
mock.module("@alfred/knowledge/ontology", () => ({
  getOntologyKnowledge: () => [],
}));

// Mock RAG
mock.module("@alfred/rag", () => ({
  embedMany: async () => [],
}));

describe("Learning Worker Integration", () => {
  beforeEach(() => {
    resetMockState();
  });

  afterEach(() => {
    stopLearningWorker();
  });

  test("worker picks up unlearned run and marks it learned", async () => {
    startLearningWorker({ intervalMs: 50, batchSize: 1 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockRuns[0].learnedAt).not.toBeNull();
  });

  test("worker runs maintenance cycle and triggers decay", async () => {
    // Short interval, maintenance interval = 0 to force run
    startLearningWorker({
      intervalMs: 50,
      batchSize: 1,
      maintenanceIntervalMs: 0, // Force immediate maintenance
      decayFactor: 0.9,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(decayCalled).toBe(true);
    expect(decayedNodes.length).toBe(1);
    expect(decayedNodes[0].id).toBe("node-decay-1");
    expect(decayedNodes[0].confidence).toBe(0.9); // 1.0 * 0.9
  });

  test("worker triggers pruning for low confidence nodes", async () => {
    startLearningWorker({
      intervalMs: 50,
      maintenanceIntervalMs: 0,
      pruneConfidence: 0.2,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(pruneCalled).toBe(true);
    expect(prunedNodeIds).toContain("node-prune-1");
  });

  test("worker triggers cleanup for archived nodes", async () => {
    startLearningWorker({
      intervalMs: 50,
      maintenanceIntervalMs: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(cleanupCalled).toBe(true);
  });

  test("worker does not trigger maintenance if interval has not passed", async () => {
    startLearningWorker({
      intervalMs: 50,
      maintenanceIntervalMs: 10_000, // Long interval
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(decayCalled).toBe(false);
    expect(pruneCalled).toBe(false);
    expect(cleanupCalled).toBe(false);
  });

  test("worker concurrency: runs processing and maintenance", async () => {
    // This test is tricky to check exact concurrency without internal spies,
    // but we can verify that both happen eventually in the same run loop
    startLearningWorker({
      intervalMs: 50,
      batchSize: 1,
      maintenanceIntervalMs: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Run processing happened?
    expect(mockRuns[0].learnedAt).not.toBeNull();
    // Maintenance happened?
    expect(decayCalled).toBe(true);
  });
});
