import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  startLearningWorker,
  stopLearningWorker,
} from "../src/orchestrator/learning-worker";
import { memoryNodes } from "@alfred/db/schema/graph";
import { workflowRuns } from "@alfred/db/schema/workflow";

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
let workflowSelectIndex = 0;
let upsertedSeeds: any[] = [];

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
      dreamedAt: null,
      errorMessage: null,
    },
    {
      id: randomUUID(),
      userId: "user-1",
      workflowId: "test-flow",
      status: "failed",
      inputData: { prompt: "merge conflict markers" },
      stateData: { tool: "git.merge" },
      completedAt: null,
      learnedAt: null,
      dreamedAt: null,
      errorMessage: "merge conflict markers found",
    },
  ];
  decayCalled = false;
  pruneCalled = false;
  cleanupCalled = false;
  decayedNodes = [];
  prunedNodeIds = [];
  workflowSelectIndex = 0;
  upsertedSeeds = [];
};

// Mock DB
mock.module("@alfred/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              if (table === workflowRuns) {
                const idx = workflowSelectIndex;
                workflowSelectIndex += 1;
                if (idx % 2 === 0) {
                  return mockRuns.filter(
                    (run) => run.status === "completed" && run.learnedAt === null
                  );
                }
                return mockRuns.filter(
                  (run) => run.status === "failed" && run.dreamedAt === null
                );
              }
              if (table === memoryNodes) {
                return [];
              }
              return [];
            },
          }),
          limit: async () => {
            if (table === workflowRuns) {
              return mockRuns;
            }
            return [];
          },
        }),
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => {
          if ("learnedAt" in patch) {
            const target = mockRuns.find(
              (run) => run.status === "completed" && run.learnedAt === null
            );
            if (target) {
              target.learnedAt = new Date();
            }
          }
          if ("dreamedAt" in patch) {
            const target = mockRuns.find(
              (run) => run.status === "failed" && run.dreamedAt === null
            );
            if (target) {
              target.dreamedAt = new Date();
            }
          }
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));

// Mock Graph Repo
mock.module("@alfred/db/repo/graph/index", () => ({
  upsertNodes: (seeds: unknown[]) => {
    upsertedSeeds.push(...(seeds as any[]));
    return Promise.resolve(new Map([["user:hash-123", { id: "node-1" }]]));
  },
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

  test("worker dreams on failed run and marks it dreamed", async () => {
    startLearningWorker({ intervalMs: 50, batchSize: 1 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockRuns[1].dreamedAt).not.toBeNull();
    const heuristicSeed = upsertedSeeds.find((seed) => (seed as any).kind === "heuristic");
    expect(heuristicSeed).toBeTruthy();
    expect((heuristicSeed as any).resource).toBe("user");
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

  afterAll(() => {
    mock.restore();
  });
});
