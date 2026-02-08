import { memoryNodes } from "@alfred/db/schema/graph";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
  vi,
} from "bun:test";

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
        confidence: 1,
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
        confidence: 1,
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
let decayCalled = false;
let pruneCalled = false;
let cleanupCalled = false;
let decayedNodes: any[] = [];
let prunedNodeIds: string[] = [];

const resetMockState = () => {
  decayCalled = false;
  pruneCalled = false;
  cleanupCalled = false;
  decayedNodes = [];
  prunedNodeIds = [];
};

const dbModule = await import("@alfred/db");
const graphRepo = await import("@alfred/db/repo/graph/index");
let dbSelectSpy: ReturnType<typeof vi.spyOn> | null = null;
let upsertNodesSpy: ReturnType<typeof vi.spyOn> | null = null;
let upsertEdgesSpy: ReturnType<typeof vi.spyOn> | null = null;
let findNodesForDecaySpy: ReturnType<typeof vi.spyOn> | null = null;
let updateNodeConfidenceBatchSpy: ReturnType<typeof vi.spyOn> | null = null;
let findNodesByConfidenceSpy: ReturnType<typeof vi.spyOn> | null = null;
let archiveNodesSpy: ReturnType<typeof vi.spyOn> | null = null;
let deleteArchivedNodesSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeAll(() => {
  dbSelectSpy = vi.spyOn(dbModule.db, "select").mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => ({
        orderBy: () => ({
          limit: () => {
            if (table === memoryNodes) {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          },
        }),
        limit: () => {
          if (table === memoryNodes) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        },
      }),
    }),
  }));

  upsertNodesSpy = vi
    .spyOn(graphRepo, "upsertNodes")
    .mockResolvedValue(new Map([["user:hash-123", { id: "node-1" }]]));
  upsertEdgesSpy = vi.spyOn(graphRepo, "upsertEdges").mockResolvedValue([]);
  findNodesForDecaySpy = vi
    .spyOn(graphRepo, "findNodesForDecay")
    .mockResolvedValue([{ id: "node-decay-1", properties: { confidence: 1 } }]);
  updateNodeConfidenceBatchSpy = vi
    .spyOn(graphRepo, "updateNodeConfidenceBatch")
    .mockImplementation((updates: unknown[]) => {
      decayCalled = true;
      decayedNodes = updates as { id: string; confidence: number }[];
      return Promise.resolve(updates.length);
    });
  findNodesByConfidenceSpy = vi
    .spyOn(graphRepo, "findNodesByConfidence")
    .mockImplementation((_min: number, max: number) => {
      if (max < 0.5) {
        return Promise.resolve([
          { id: "node-prune-1", properties: { confidence: 0.1 } },
        ]);
      }
      return Promise.resolve([]);
    });
  archiveNodesSpy = vi
    .spyOn(graphRepo, "archiveNodes")
    .mockImplementation((ids: string[]) => {
      pruneCalled = true;
      prunedNodeIds = ids;
      return Promise.resolve(ids.length);
    });
  deleteArchivedNodesSpy = vi
    .spyOn(graphRepo, "deleteArchivedNodes")
    .mockImplementation(() => {
      cleanupCalled = true;
      return Promise.resolve(1);
    });
});

afterAll(() => {
  dbSelectSpy?.mockRestore();
  dbSelectSpy = null;
  upsertNodesSpy?.mockRestore();
  upsertNodesSpy = null;
  upsertEdgesSpy?.mockRestore();
  upsertEdgesSpy = null;
  findNodesForDecaySpy?.mockRestore();
  findNodesForDecaySpy = null;
  updateNodeConfidenceBatchSpy?.mockRestore();
  updateNodeConfidenceBatchSpy = null;
  findNodesByConfidenceSpy?.mockRestore();
  findNodesByConfidenceSpy = null;
  archiveNodesSpy?.mockRestore();
  archiveNodesSpy = null;
  deleteArchivedNodesSpy?.mockRestore();
  deleteArchivedNodesSpy = null;
});

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

  test("worker runs maintenance cycle and triggers decay", async () => {
    // Short interval, maintenance interval = 0 to force run
    startLearningWorker({
      maintenanceIntervalMs: 50,
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
      maintenanceIntervalMs: 50,
      pruneConfidence: 0.2,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(pruneCalled).toBe(true);
    expect(prunedNodeIds).toContain("node-prune-1");
  });

  test("worker triggers cleanup for archived nodes", async () => {
    startLearningWorker({
      maintenanceIntervalMs: 50,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(cleanupCalled).toBe(true);
  });

  test("worker does not trigger maintenance if interval has not passed", async () => {
    startLearningWorker({
      maintenanceIntervalMs: 10_000, // Long interval
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    decayCalled = false;
    pruneCalled = false;
    cleanupCalled = false;

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(decayCalled).toBe(false);
    expect(pruneCalled).toBe(false);
    expect(cleanupCalled).toBe(false);
  });

  afterAll(() => {
    mock.restore();
  });
});
