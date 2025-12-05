/**
 * Memory Tools Test Suite
 *
 * Comprehensive tests for explicit memory tools.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock the graph repo functions before importing tools
const mockGetNode = mock(() => Promise.resolve(null));
const mockGetNeighbors = mock(() => Promise.resolve([]));
const mockRecordAccess = mock(() => Promise.resolve());
const mockRecordAccessBatch = mock(() => Promise.resolve());
const mockUpdateNode = mock(() => Promise.resolve(null));
const mockUpdateNodeConfidence = mock(() => Promise.resolve(null));
const mockArchiveNodes = mock(() => Promise.resolve(0));
const mockDeleteNode = mock(() => Promise.resolve(0));
const mockDsaBfs = mock(() => Promise.resolve(null));
const mockEmbedMany = mock(() => Promise.resolve([[0.1, 0.2, 0.3]]));
const mockGetConversation = mock(() => Promise.resolve(null));
const mockGetConversations = mock(() => Promise.resolve([]));
const mockGetConversationHistory = mock(() => Promise.resolve(null));
const mockGetMessages = mock(() => Promise.resolve([]));
const mockMessageRowToUIMessage = mock((row: any) => ({
  id: row.id,
  role: row.role,
  parts: row.parts ?? [],
}));

// Mock modules
mock.module("@alfred/db/repo/graph/read", () => ({
  getNode: mockGetNode,
  getNeighbors: mockGetNeighbors,
  recordAccess: mockRecordAccess,
  recordAccessBatch: mockRecordAccessBatch,
}));

mock.module("@alfred/db/repo/graph/write", () => ({
  updateNode: mockUpdateNode,
  updateNodeConfidence: mockUpdateNodeConfidence,
  archiveNodes: mockArchiveNodes,
  deleteNode: mockDeleteNode,
  touchNodes: mock(() => Promise.resolve(0)),
}));

mock.module("@alfred/db/repo/graph/dsa-bfs", () => ({
  dsaBfs: mockDsaBfs,
}));

mock.module("@alfred/rag", () => ({
  embedMany: mockEmbedMany,
}));

mock.module("@alfred/db/repo/conversation", () => ({
  getConversation: mockGetConversation,
  getConversations: mockGetConversations,
  getConversationHistory: mockGetConversationHistory,
  getMessages: mockGetMessages,
  messageRowToUIMessage: mockMessageRowToUIMessage,
}));

// Mock metrics
mock.module("../../../../src/metrics", () => ({
  recordAssistantToolCall: mock(() => {}),
  recordMemoryToolCall: mock(() => {}),
  recordMemorySearchLatency: mock(() => {}),
  recordMemorySearchResults: mock(() => {}),
  recordMemoryBoost: mock(() => {}),
  recordMemoryRemoval: mock(() => {}),
  recordMemoryTraverseDepth: mock(() => {}),
}));

import { toolMemoryBoost } from "../../assistant/src/tool/memory/boost";
// Import tools after mocks are set up
import {
  embedQuery,
  embedTexts,
  normalizeEmbedding,
} from "../../assistant/src/tool/memory/embed";
import { toolMemoryHistory } from "../../assistant/src/tool/memory/history";
import { toolMemoryRemove } from "../../assistant/src/tool/memory/remove";
import { toolMemoryRetrieve } from "../../assistant/src/tool/memory/retrieve";
import { toolMemoryUpdate } from "../../assistant/src/tool/memory/update";

describe("Memory Tools", () => {
  beforeEach(() => {
    // Reset all mocks
    mockGetNode.mockReset();
    mockGetNeighbors.mockReset();
    mockRecordAccess.mockReset();
    mockRecordAccessBatch.mockReset();
    mockUpdateNode.mockReset();
    mockUpdateNodeConfidence.mockReset();
    mockArchiveNodes.mockReset();
    mockDeleteNode.mockReset();
    mockDsaBfs.mockReset();
    mockEmbedMany.mockReset();
    mockGetConversation.mockReset();
    mockGetConversations.mockReset();
    mockGetConversationHistory.mockReset();
    mockGetMessages.mockReset();

    // Set default return values
    mockEmbedMany.mockReturnValue(Promise.resolve([[0.1, 0.2, 0.3]]));
    mockRecordAccess.mockReturnValue(Promise.resolve());
    mockRecordAccessBatch.mockReturnValue(Promise.resolve());
  });

  describe("Embedding Utilities", () => {
    describe("embedQuery", () => {
      it("embeds a valid query string", async () => {
        const result = await embedQuery("test query");
        expect(result).toEqual([0.1, 0.2, 0.3]);
        expect(mockEmbedMany).toHaveBeenCalledWith(["test query"]);
      });

      it("trims whitespace from query", async () => {
        await embedQuery("  test query  ");
        expect(mockEmbedMany).toHaveBeenCalledWith(["test query"]);
      });

      it("throws for empty query", async () => {
        await expect(embedQuery("")).rejects.toThrow("memory_query_empty");
      });

      it("throws for whitespace-only query", async () => {
        await expect(embedQuery("   ")).rejects.toThrow("memory_query_empty");
      });
    });

    describe("embedTexts", () => {
      it("embeds multiple texts", async () => {
        mockEmbedMany.mockReturnValue(
          Promise.resolve([
            [0.1, 0.2],
            [0.3, 0.4],
          ])
        );
        const result = await embedTexts(["text1", "text2"]);
        expect(result).toEqual([
          [0.1, 0.2],
          [0.3, 0.4],
        ]);
      });

      it("returns empty array for empty input", async () => {
        const result = await embedTexts([]);
        expect(result).toEqual([]);
        expect(mockEmbedMany).not.toHaveBeenCalled();
      });

      it("filters out empty strings", async () => {
        await embedTexts(["text1", "", "text2", "   "]);
        expect(mockEmbedMany).toHaveBeenCalledWith(["text1", "text2"]);
      });
    });

    describe("normalizeEmbedding", () => {
      it("returns null for null/undefined", () => {
        expect(normalizeEmbedding(null)).toBeNull();
        expect(normalizeEmbedding(undefined)).toBeNull();
      });

      it("normalizes array of numbers", () => {
        expect(normalizeEmbedding([1, 2, 3])).toEqual([1, 2, 3]);
      });

      it("filters non-finite numbers", () => {
        expect(
          normalizeEmbedding([1, Number.NaN, 2, Number.POSITIVE_INFINITY])
        ).toEqual([1, 2]);
      });

      it("parses JSON string arrays", () => {
        expect(normalizeEmbedding("[1, 2, 3]")).toEqual([1, 2, 3]);
      });

      it("returns null for invalid JSON", () => {
        expect(normalizeEmbedding("not json")).toBeNull();
      });

      it("returns null for empty arrays", () => {
        expect(normalizeEmbedding([])).toBeNull();
      });
    });
  });

  describe("memory_retrieve", () => {
    const mockNode = {
      id: "test-id-1234-5678-9012",
      label: "Test Node",
      kind: "fact",
      resource: "user",
      properties: { confidence: 0.8 },
      accessCount: 5,
      lastAccessedAt: new Date(),
      created: new Date(),
      updated: new Date(),
    };

    it("returns not found for missing node", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(null));

      const result = await toolMemoryRetrieve.execute({
        input: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result.found).toBe(false);
      expect(result.memory).toBeNull();
    });

    it("retrieves a node successfully", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryRetrieve.execute({
        input: { id: "test-id-1234-5678-9012" },
      });

      expect(result.found).toBe(true);
      expect(result.memory).not.toBeNull();
      expect(result.memory?.label).toBe("Test Node");
      expect(result.memory?.confidence).toBe(0.8);
    });

    it("records access on retrieval", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));

      await toolMemoryRetrieve.execute({
        input: { id: "test-id-1234-5678-9012" },
      });

      expect(mockRecordAccess).toHaveBeenCalledWith("test-id-1234-5678-9012");
    });

    it("includes neighbors when requested", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockGetNeighbors.mockReturnValue(
        Promise.resolve([
          {
            edge: {
              id: "edge-1",
              fromId: "test-id-1234-5678-9012",
              toId: "neighbor-1",
              kind: "related",
            },
            otherNodeId: "neighbor-1",
          },
        ])
      );

      const result = await toolMemoryRetrieve.execute({
        input: { id: "test-id-1234-5678-9012", includeNeighbors: true },
      });

      expect(result.neighbors).toBeDefined();
      expect(mockGetNeighbors).toHaveBeenCalled();
    });
  });

  describe("memory_update", () => {
    const mockNode = {
      id: "test-id-1234-5678-9012",
      label: "Test Node",
      kind: "fact",
      resource: "user",
      properties: { confidence: 0.5 },
    };

    it("returns failure for non-existent node", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(null));

      const result = await toolMemoryUpdate.execute({
        input: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Memory not found");
    });

    it("updates confidence successfully", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNodeConfidence.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryUpdate.execute({
        input: { id: "test-id-1234-5678-9012", confidence: 0.9 },
      });

      expect(result.success).toBe(true);
      expect(result.changes.confidence).toBe(true);
      expect(mockUpdateNodeConfidence).toHaveBeenCalledWith(
        "test-id-1234-5678-9012",
        0.9
      );
    });

    it("updates label successfully", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNode.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryUpdate.execute({
        input: { id: "test-id-1234-5678-9012", label: "New Label" },
      });

      expect(result.success).toBe(true);
      expect(result.changes.label).toBe(true);
    });

    it("merges properties with existing", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNode.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryUpdate.execute({
        input: {
          id: "test-id-1234-5678-9012",
          properties: { newProp: "value" },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes.properties).toBe(true);
    });
  });

  describe("memory_remove", () => {
    const mockNode = {
      id: "test-id-1234-5678-9012",
      label: "Test Node",
      kind: "fact",
      resource: "user",
      properties: {},
    };

    it("returns failure for non-existent node", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(null));

      const result = await toolMemoryRemove.execute({
        input: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result.success).toBe(false);
      expect(result.action).toBe("not_found");
    });

    it("archives node by default (soft delete)", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockArchiveNodes.mockReturnValue(Promise.resolve(1));

      const result = await toolMemoryRemove.execute({
        input: { id: "test-id-1234-5678-9012" },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("archived");
      expect(mockArchiveNodes).toHaveBeenCalled();
      expect(mockDeleteNode).not.toHaveBeenCalled();
    });

    it("archives with custom reason", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockArchiveNodes.mockReturnValue(Promise.resolve(1));

      const result = await toolMemoryRemove.execute({
        input: { id: "test-id-1234-5678-9012", reason: "outdated" },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("outdated");
    });

    it("permanently deletes when permanent=true", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockDeleteNode.mockReturnValue(Promise.resolve(1));

      const result = await toolMemoryRemove.execute({
        input: { id: "test-id-1234-5678-9012", permanent: true },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("deleted");
      expect(mockDeleteNode).toHaveBeenCalled();
    });

    it("reports already archived node", async () => {
      mockGetNode.mockReturnValue(
        Promise.resolve({
          ...mockNode,
          properties: { archived: true },
        })
      );

      const result = await toolMemoryRemove.execute({
        input: { id: "test-id-1234-5678-9012" },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Memory is already archived");
    });
  });

  describe("memory_boost", () => {
    const mockNode = {
      id: "test-id-1234-5678-9012",
      label: "Test Node",
      kind: "fact",
      resource: "user",
      properties: { confidence: 0.5 },
    };

    it("returns failure for non-existent node", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(null));

      const result = await toolMemoryBoost.execute({
        input: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Memory not found");
    });

    it("boosts confidence by default amount (0.1)", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNodeConfidence.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryBoost.execute({
        input: { id: "test-id-1234-5678-9012" },
      });

      expect(result.success).toBe(true);
      expect(result.previousConfidence).toBe(0.5);
      expect(result.newConfidence).toBe(0.6);
      expect(mockUpdateNodeConfidence).toHaveBeenCalledWith(
        "test-id-1234-5678-9012",
        0.6
      );
    });

    it("boosts by custom amount", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNodeConfidence.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryBoost.execute({
        input: { id: "test-id-1234-5678-9012", amount: 0.3 },
      });

      expect(result.newConfidence).toBe(0.8);
    });

    it("caps confidence at 1.0", async () => {
      mockGetNode.mockReturnValue(
        Promise.resolve({
          ...mockNode,
          properties: { confidence: 0.95 },
        })
      );
      mockUpdateNodeConfidence.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryBoost.execute({
        input: { id: "test-id-1234-5678-9012", amount: 0.2 },
      });

      expect(result.newConfidence).toBe(1);
    });

    it("includes reason in message", async () => {
      mockGetNode.mockReturnValue(Promise.resolve(mockNode));
      mockUpdateNodeConfidence.mockReturnValue(Promise.resolve(mockNode));

      const result = await toolMemoryBoost.execute({
        input: {
          id: "test-id-1234-5678-9012",
          reason: "User confirmed this is correct",
        },
      });

      expect(result.message).toContain("User confirmed this is correct");
    });
  });

  describe("memory_history", () => {
    it("returns failure for non-existent conversation", async () => {
      mockGetConversationHistory.mockReturnValue(Promise.resolve(null));

      const result = await toolMemoryHistory.execute({
        input: {
          userId: "user-1",
          conversationId: "00000000-0000-0000-0000-000000000000",
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Conversation not found");
    });

    it("retrieves conversation messages", async () => {
      mockGetConversationHistory.mockReturnValue(
        Promise.resolve({
          conversation: {
            id: "conv-1",
            title: "Test Conversation",
            created: new Date(),
            updated: new Date(),
          },
          messages: [
            {
              id: "msg-1",
              role: "user",
              parts: [{ type: "text", text: "Hello" }],
            },
            {
              id: "msg-2",
              role: "assistant",
              parts: [{ type: "text", text: "Hi there!" }],
            },
          ],
        })
      );

      const result = await toolMemoryHistory.execute({
        input: { userId: "user-1", conversationId: "conv-1" },
      });

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[0]?.preview).toBe("Hello");
    });

    it("filters messages by search term", async () => {
      mockGetConversationHistory.mockReturnValue(
        Promise.resolve({
          conversation: {
            id: "conv-1",
            title: "Test",
            created: new Date(),
            updated: new Date(),
          },
          messages: [
            {
              id: "msg-1",
              role: "user",
              parts: [{ type: "text", text: "Hello world" }],
            },
            {
              id: "msg-2",
              role: "assistant",
              parts: [{ type: "text", text: "Goodbye" }],
            },
          ],
        })
      );

      const result = await toolMemoryHistory.execute({
        input: { userId: "user-1", conversationId: "conv-1", search: "world" },
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages?.[0]?.id).toBe("msg-1");
    });

    it("lists recent conversations when no conversationId", async () => {
      mockGetConversations.mockReturnValue(
        Promise.resolve([
          {
            id: "conv-1",
            title: "First",
            userId: "user-1",
            created: new Date(),
            updated: new Date(),
          },
          {
            id: "conv-2",
            title: "Second",
            userId: "user-1",
            created: new Date(),
            updated: new Date(),
          },
        ])
      );
      mockGetMessages.mockReturnValue(Promise.resolve([]));

      const result = await toolMemoryHistory.execute({
        input: { userId: "user-1" },
      });

      expect(result.success).toBe(true);
      expect(result.conversations).toHaveLength(2);
    });
  });

  describe("Input Validation", () => {
    it("validates memory_retrieve input", () => {
      const schema = toolMemoryRetrieve.inputSchema;

      // Valid input
      expect(() =>
        schema.parse({ id: "00000000-0000-0000-0000-000000000000" })
      ).not.toThrow();

      // Invalid UUID
      expect(() => schema.parse({ id: "not-a-uuid" })).toThrow();

      // Missing required field
      expect(() => schema.parse({})).toThrow();
    });

    it("validates memory_update input", () => {
      const schema = toolMemoryUpdate.inputSchema;

      // Valid with confidence
      expect(() =>
        schema.parse({
          id: "00000000-0000-0000-0000-000000000000",
          confidence: 0.8,
        })
      ).not.toThrow();

      // Confidence out of range
      expect(() =>
        schema.parse({
          id: "00000000-0000-0000-0000-000000000000",
          confidence: 1.5,
        })
      ).toThrow();
    });

    it("validates memory_boost input", () => {
      const schema = toolMemoryBoost.inputSchema;

      // Valid with amount
      expect(() =>
        schema.parse({
          id: "00000000-0000-0000-0000-000000000000",
          amount: 0.2,
        })
      ).not.toThrow();

      // Amount too high
      expect(() =>
        schema.parse({
          id: "00000000-0000-0000-0000-000000000000",
          amount: 1.0,
        })
      ).toThrow();

      // Amount too low
      expect(() =>
        schema.parse({
          id: "00000000-0000-0000-0000-000000000000",
          amount: 0.001,
        })
      ).toThrow();
    });

    it("validates memory_history input", () => {
      const schema = toolMemoryHistory.inputSchema;

      // Valid minimal
      expect(() => schema.parse({ userId: "user-1" })).not.toThrow();

      // Valid with options
      expect(() =>
        schema.parse({
          userId: "user-1",
          limit: 50,
          days: 30,
        })
      ).not.toThrow();

      // Limit out of range
      expect(() =>
        schema.parse({
          userId: "user-1",
          limit: 200,
        })
      ).toThrow();
    });
  });

  describe("Tool Metadata", () => {
    it("memory_retrieve has correct metadata", () => {
      expect(toolMemoryRetrieve.name).toBe("memory_retrieve");
      expect(toolMemoryRetrieve.description).toContain("specific memory");
    });

    it("memory_update has correct metadata", () => {
      expect(toolMemoryUpdate.name).toBe("memory_update");
      expect(toolMemoryUpdate.description).toContain("Update");
    });

    it("memory_remove has correct metadata", () => {
      expect(toolMemoryRemove.name).toBe("memory_remove");
      expect(toolMemoryRemove.description).toContain("Remove");
    });

    it("memory_boost has correct metadata", () => {
      expect(toolMemoryBoost.name).toBe("memory_boost");
      expect(toolMemoryBoost.description).toContain("Reinforce");
    });

    it("memory_history has correct metadata", () => {
      expect(toolMemoryHistory.name).toBe("memory_history");
      expect(toolMemoryHistory.description).toContain("conversation history");
    });
  });
});
