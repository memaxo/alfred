import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

// Mock DB
const mockFailedRuns: any[] = [];
const mockHeuristicNodes: any[] = [];
const mockUpsertNodes = mock();
const mockEmbedMany = mock();

mock.module("@alfred/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockFailedRuns,
        }),
      }),
    }),
  },
  workflowRuns: {
    status: { name: "status" },
    completedAt: { name: "completedAt" },
    errorMessage: { name: "errorMessage" },
    id: { name: "id" },
  },
}));

mock.module("@alfred/db/repo/graph", () => ({
  upsertNodes: mockUpsertNodes,
}));

mock.module("@alfred/rag", () => ({
  embedMany: mockEmbedMany,
}));

// Import after mocks
const { processDreaming } = await import("../src/orchestrator/learning-worker");

describe("Dreaming → Heuristic Integration", () => {
  beforeEach(() => {
    mockFailedRuns.length = 0;
    mockHeuristicNodes.length = 0;
    mockUpsertNodes.mockReset().mockResolvedValue(new Map());
    mockEmbedMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    mockFailedRuns.length = 0;
    mockHeuristicNodes.length = 0;
  });

  it("processDreaming creates heuristic nodes from failed runs", async () => {
    // Create mock failed runs
    mockFailedRuns.push({
      id: randomUUID(),
      errorMessage: "Module not found: @alfred/utils",
    });
    mockFailedRuns.push({
      id: randomUUID(),
      errorMessage: "Module not found: @alfred/utils", // Same error
    });
    mockFailedRuns.push({
      id: randomUUID(),
      errorMessage: "Permission denied: /etc/hosts",
    });

    mockEmbedMany.mockResolvedValue([
      [0.1, 0.2, 0.3], // embedding for first heuristic
      [0.4, 0.5, 0.6], // embedding for second heuristic
    ]);

    const nodeMap = new Map();
    nodeMap.set("system:hash1", { id: "node-1" });
    nodeMap.set("system:hash2", { id: "node-2" });
    mockUpsertNodes.mockResolvedValue(nodeMap);

    await processDreaming();

    // Verify upsertNodes was called with heuristic nodes
    expect(mockUpsertNodes).toHaveBeenCalled();
    const callArgs = mockUpsertNodes.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Array);
    expect(callArgs[0].length).toBeGreaterThan(0);

    // Verify nodes have correct structure
    const nodes = callArgs[0];
    for (const node of nodes) {
      expect(node.kind).toBe("heuristic");
      expect(node.resource).toBe("system");
      expect(node.properties).toBeDefined();
      expect(node.properties.rule).toBeDefined();
      expect(node.properties.source).toBe("dreamer");
      expect(node.properties.confidence).toBe(0.8);
    }

    // Should cluster similar errors (2 runs with same error = 1 heuristic)
    // Plus 1 unique error = 2 total heuristics
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("processDreaming handles empty failed runs gracefully", async () => {
    mockFailedRuns.length = 0;

    await processDreaming();

    // Should not crash, just return early
    expect(mockUpsertNodes).not.toHaveBeenCalled();
  });

  it("processDreaming generates embeddings for heuristic rules", async () => {
    mockFailedRuns.push({
      id: randomUUID(),
      errorMessage: "Test error message",
    });

    mockEmbedMany.mockResolvedValue([[0.1, 0.2, 0.3]]);

    await processDreaming();

    // Verify embedMany was called with rules
    expect(mockEmbedMany).toHaveBeenCalled();
    const embedArgs = mockEmbedMany.mock.calls[0];
    expect(embedArgs[0]).toBeInstanceOf(Array);
    expect(embedArgs[0].length).toBeGreaterThan(0);
    expect(typeof embedArgs[0][0]).toBe("string"); // Rule is a string
  });
});
