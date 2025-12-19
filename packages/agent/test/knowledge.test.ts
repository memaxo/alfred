import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  KnowledgeConnectInput,
  KnowledgeCorrectInput,
  KnowledgeExtractInput,
  KnowledgeQueryInput,
} from "../src/orchestrator/tool/knowledge/definition";

// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock, resetLoggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

const mockExtract = mock();
const mockToKnowledge = mock();
mock.module("@alfred/knowledge", () => ({
  extract: mockExtract,
  toKnowledge: mockToKnowledge,
  semanticQuery: mock(),
}));

const mockFindNodesByKind = mock();
const mockGetNode = mock();
const mockFindNodeByHash = mock();
const mockGetOutboundEdges = mock();
const mockGetEdge = mock();
const mockUpsertNodes = mock();
const mockUpsertEdges = mock();
const mockUpdateNode = mock();
const mockArchiveNodes = mock();
const mockCreateCorrection = mock();
const mockRecordAccessBatch = mock();
mock.module("@alfred/db/repo/graph", () => ({
  findNodesByKind: mockFindNodesByKind,
  getNode: mockGetNode,
  findNodeByHash: mockFindNodeByHash,
  getOutboundEdges: mockGetOutboundEdges,
  getEdge: mockGetEdge,
  upsertNodes: mockUpsertNodes,
  upsertEdges: mockUpsertEdges,
  updateNode: mockUpdateNode,
  archiveNodes: mockArchiveNodes,
  createCorrection: mockCreateCorrection,
  recordAccessBatch: mockRecordAccessBatch,
}));

// Import tools after mocking
const {
  toolKnowledgeQuery,
  toolKnowledgeExtract,
  toolKnowledgeConnect,
  toolKnowledgeCorrect,
} = await import("../src/orchestrator/tool/knowledge");

describe("Knowledge Graph Tools", () => {
  beforeEach(() => {
    authTokenMocks.requireToolScopesAndPolicy.mockReset();
    mockExtract.mockReset();
    mockToKnowledge.mockReset();
    mockFindNodesByKind.mockReset();
    mockGetNode.mockReset();
    mockFindNodeByHash.mockReset();
    mockGetOutboundEdges.mockReset();
    mockGetEdge.mockReset();
    mockUpsertNodes.mockReset();
    mockUpsertEdges.mockReset();
    mockUpdateNode.mockReset();
    mockArchiveNodes.mockReset();
    mockCreateCorrection.mockReset();
    mockRecordAccessBatch.mockReset().mockResolvedValue(0);

    // Default to allowing all policy checks
    authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["knowledge.read", "knowledge.write"],
        elevated: true,
        mfa: "passkey",
      },
    });
  });

  describe("knowledge_query", () => {
    it("returns matching nodes from the knowledge graph", async () => {
      const mockNodes = [
        {
          id: "node-1",
          resource: "user",
          hash: "hash-1",
          kind: "fact",
          label: "React is a JavaScript library for building user interfaces",
          properties: { confidence: 0.9 },
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "node-2",
          resource: "user",
          hash: "hash-2",
          kind: "fact",
          label: "React uses JSX syntax for components",
          properties: { confidence: 0.85 },
          created: new Date(),
          updated: new Date(),
        },
      ];

      mockFindNodesByKind.mockResolvedValue(mockNodes);

      const input: KnowledgeQueryInput = {
        query: "React JavaScript library",
        limit: 10,
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeQuery.execute({ input });

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].label).toContain("React");
      expect(result.total).toBe(2);
    });

    it("filters by resource when specified", async () => {
      const mockNodes = [
        {
          id: "node-1",
          resource: "user",
          hash: "hash-1",
          kind: "fact",
          label: "User fact about coding",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "node-2",
          resource: "runtime:123",
          hash: "hash-2",
          kind: "fact",
          label: "Runtime fact about coding",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
      ];

      mockFindNodesByKind.mockResolvedValue(mockNodes);

      const input: KnowledgeQueryInput = {
        query: "coding",
        resource: "user",
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeQuery.execute({ input });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe("node-1");
    });

    it("calls recordAccessBatch for active recall after retrieving nodes", async () => {
      const mockNodes = [
        {
          id: "node-1",
          resource: "user",
          hash: "hash-1",
          kind: "fact",
          label: "Test fact 1",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "node-2",
          resource: "user",
          hash: "hash-2",
          kind: "fact",
          label: "Test fact 2",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
      ];

      mockFindNodesByKind.mockResolvedValue(mockNodes);
      mockRecordAccessBatch.mockResolvedValue(2);

      const input: KnowledgeQueryInput = {
        query: "test",
        limit: 10,
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeQuery.execute({ input });

      expect(result.nodes).toHaveLength(2);
      // Verify recordAccessBatch was called with node IDs
      expect(mockRecordAccessBatch).toHaveBeenCalled();
      const callArgs = mockRecordAccessBatch.mock.calls[0];
      expect(callArgs[0]).toEqual(["node-1", "node-2"]);
    });

    it("handles recordAccessBatch failure gracefully", async () => {
      const mockNodes = [
        {
          id: "node-1",
          resource: "user",
          hash: "hash-1",
          kind: "fact",
          label: "Test fact",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
      ];

      mockFindNodesByKind.mockResolvedValue(mockNodes);
      mockRecordAccessBatch.mockRejectedValue(new Error("DB error"));

      const input: KnowledgeQueryInput = {
        query: "test",
        limit: 10,
        authz: "Bearer test-token",
      };

      // Should still succeed despite recordAccessBatch failure
      const result = await toolKnowledgeQuery.execute({ input });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe("node-1");
    });

    it("includes edges when requested", async () => {
      const mockNodes = [
        {
          id: "node-1",
          resource: "user",
          hash: "hash-1",
          kind: "fact",
          label: "Docker containers",
          properties: {},
          created: new Date(),
          updated: new Date(),
        },
      ];

      const mockEdges = [
        {
          id: "edge-1",
          fromId: "node-1",
          toId: "node-2",
          kind: "relates_to",
          resource: "user",
          hash: "edge-hash-1",
          weight: 1,
          created: new Date(),
        },
      ];

      mockFindNodesByKind.mockResolvedValue(mockNodes);
      mockGetOutboundEdges.mockResolvedValue(mockEdges);

      const input: KnowledgeQueryInput = {
        query: "Docker",
        includeEdges: true,
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeQuery.execute({ input });

      expect(result.nodes).toHaveLength(1);
      // Edges only included if target node is also in results
      expect(mockGetOutboundEdges).toHaveBeenCalled();
    });

    it("enforces knowledge.read policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: KnowledgeQueryInput = {
        query: "test query",
      };

      await expect(toolKnowledgeQuery.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });
  });

  describe("knowledge_extract", () => {
    it("extracts and persists knowledge from text", async () => {
      const extractionResult = {
        facts: [
          {
            content: "SpaceX was founded in 2002",
            confidence: 0.9,
            source: "conversation",
            entities: ["SpaceX"],
            relations: [],
          },
        ],
        entities: new Set(["SpaceX"]),
        entityDetails: [
          {
            label: "SpaceX",
            kind: "organization",
            confidence: 0.95,
            mentions: [],
            isPronoun: false,
          },
        ],
        relations: [],
        contradictions: [],
        temporal: [],
      };

      const knowledgeEntries = [
        {
          hash: "fact-hash-1",
          data: {
            _: "fact" as const,
            content: "SpaceX was founded in 2002",
            confidence: 0.9,
            source: "conversation",
          },
        },
      ];

      const nodeMap = new Map([
        [
          "user:fact-hash-1",
          {
            id: "node-1",
            resource: "user",
            hash: "fact-hash-1",
            kind: "fact",
            label: "SpaceX was founded in 2002",
            properties: { confidence: 0.9 },
            created: new Date(),
            updated: new Date(),
          },
        ],
      ]);

      mockExtract.mockReturnValue(extractionResult);
      mockToKnowledge.mockReturnValue(knowledgeEntries);
      mockUpsertNodes.mockResolvedValue(nodeMap);

      const input: KnowledgeExtractInput = {
        content: "SpaceX was founded in 2002 by Elon Musk.",
        source: "conversation",
        resource: "user",
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeExtract.execute({ input });

      expect(result.extracted).toBe(1);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].label).toContain("SpaceX");
      expect(mockExtract).toHaveBeenCalledWith(input.content, input.source);
    });

    it("returns empty result for content with no extractable facts", async () => {
      mockExtract.mockReturnValue({
        facts: [],
        entities: new Set(),
        entityDetails: [],
        relations: [],
        contradictions: [],
        temporal: [],
      });
      mockToKnowledge.mockReturnValue([]);

      const input: KnowledgeExtractInput = {
        content: "Hello there.",
        source: "test",
        resource: "user",
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeExtract.execute({ input });

      expect(result.extracted).toBe(0);
      expect(result.facts).toHaveLength(0);
    });

    it("enforces knowledge.write policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: KnowledgeExtractInput = {
        content: "Test content",
        source: "test",
        resource: "user",
      };

      await expect(toolKnowledgeExtract.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });

    it("rejects content exceeding max size", async () => {
      const input: KnowledgeExtractInput = {
        content: "x".repeat(101 * 1024), // 101KB
        source: "test",
        resource: "user",
        authz: "Bearer test-token",
      };

      await expect(toolKnowledgeExtract.execute({ input })).rejects.toThrow(
        "knowledge_content_too_large"
      );
    });
  });

  describe("knowledge_connect", () => {
    it("creates an edge between two nodes", async () => {
      const fromNode = {
        id: "node-1",
        resource: "user",
        hash: "hash-1",
        kind: "fact",
        label: "React",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      const toNode = {
        id: "node-2",
        resource: "user",
        hash: "hash-2",
        kind: "fact",
        label: "Frontend",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      const createdEdge = {
        id: "edge-1",
        resource: "user",
        hash: "node-1-node-2-relates_to",
        fromId: "node-1",
        toId: "node-2",
        kind: "relates_to",
        weight: 1,
        metadata: null,
        created: new Date(),
      };

      mockGetNode.mockResolvedValueOnce(fromNode).mockResolvedValueOnce(toNode);
      mockUpsertEdges.mockResolvedValue([createdEdge]);

      const input: KnowledgeConnectInput = {
        fromId: "node-1",
        toId: "node-2",
        kind: "relates_to",
        resource: "user",
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeConnect.execute({ input });

      expect(result.edgeId).toBe("edge-1");
      expect(result.fromId).toBe("node-1");
      expect(result.toId).toBe("node-2");
      expect(result.kind).toBe("relates_to");
    });

    it("throws error if source node not found", async () => {
      mockGetNode.mockResolvedValueOnce(null);

      const input: KnowledgeConnectInput = {
        fromId: "non-existent",
        toId: "node-2",
        kind: "relates_to",
        resource: "user",
        authz: "Bearer test-token",
      };

      await expect(toolKnowledgeConnect.execute({ input })).rejects.toThrow(
        "knowledge_node_not_found: non-existent"
      );
    });

    it("throws error if target node not found", async () => {
      const fromNode = {
        id: "node-1",
        resource: "user",
        hash: "hash-1",
        kind: "fact",
        label: "React",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      mockGetNode.mockResolvedValueOnce(fromNode).mockResolvedValueOnce(null);

      const input: KnowledgeConnectInput = {
        fromId: "node-1",
        toId: "non-existent",
        kind: "relates_to",
        resource: "user",
        authz: "Bearer test-token",
      };

      await expect(toolKnowledgeConnect.execute({ input })).rejects.toThrow(
        "knowledge_node_not_found: non-existent"
      );
    });

    it("enforces knowledge.write policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: KnowledgeConnectInput = {
        fromId: "node-1",
        toId: "node-2",
        kind: "relates_to",
        resource: "user",
      };

      await expect(toolKnowledgeConnect.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });

    it("supports all edge types", () => {
      const fromNode = {
        id: "node-1",
        resource: "user",
        hash: "h1",
        kind: "fact",
        label: "A",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };
      const toNode = {
        id: "node-2",
        resource: "user",
        hash: "h2",
        kind: "fact",
        label: "B",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      mockGetNode.mockResolvedValue(fromNode).mockResolvedValue(toNode);
      mockUpsertEdges.mockResolvedValue([
        {
          id: "edge-1",
          resource: "user",
          hash: "hash",
          fromId: "node-1",
          toId: "node-2",
          kind: "depends_on",
          weight: 1,
          metadata: null,
          created: new Date(),
        },
      ]);

      const edgeTypes = [
        "relates_to",
        "blocks",
        "depends_on",
        "is_a",
        "part_of",
      ] as const;

      for (const kind of edgeTypes) {
        const result = toolKnowledgeConnect.inputSchema.safeParse({
          fromId: "node-1",
          toId: "node-2",
          kind,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("knowledge_correct", () => {
    it("updates a node label and records a correction", async () => {
      const node = {
        id: "node-1",
        resource: "user",
        hash: "hash-1",
        kind: "fact",
        label: "SpaceX was founded in 2000",
        properties: { confidence: 0.8 },
        created: new Date(),
        updated: new Date(),
      };

      mockGetNode.mockResolvedValue(node);
      mockUpdateNode.mockResolvedValue({
        ...node,
        label: "SpaceX was founded in 2002",
      });
      mockCreateCorrection.mockResolvedValue({ id: "correction-1" });

      const input: KnowledgeCorrectInput = {
        nodeId: "node-1",
        resource: "user",
        correction: {
          type: "update",
          newValue: "SpaceX was founded in 2002",
          reason: "Incorrect founding year",
        },
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeCorrect.execute({ input });

      expect(result.corrected).toBe(true);
      expect(result.nodeId).toBe("node-1");
      expect(result.correctionId).toBe("correction-1");
      expect(result.previousValue?.label).toBe("SpaceX was founded in 2000");
      expect(mockUpdateNode).toHaveBeenCalledTimes(1);
      expect(mockCreateCorrection).toHaveBeenCalledTimes(1);
    });

    it("updates node properties using propertiesPatch", async () => {
      const node = {
        id: "node-1",
        resource: "user",
        hash: "hash-1",
        kind: "fact",
        label: "React release date",
        properties: { confidence: 0.4, source: "conversation" },
        created: new Date(),
        updated: new Date(),
      };

      mockGetNode.mockResolvedValue(node);
      mockUpdateNode.mockImplementation((_id: string, updates: unknown) => {
        const u = updates as { properties?: Record<string, unknown> };
        return Promise.resolve({
          ...node,
          properties: u.properties ?? node.properties,
        });
      });
      mockCreateCorrection.mockResolvedValue({ id: "correction-1" });

      const input: KnowledgeCorrectInput = {
        nodeId: "node-1",
        resource: "user",
        correction: {
          type: "update",
          reason: "Adjust confidence",
          propertiesPatch: { confidence: 0.9 },
        },
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeCorrect.execute({ input });

      expect(result.corrected).toBe(true);
      expect(mockUpdateNode).toHaveBeenCalledTimes(1);
    });

    it("archives a node when delete is requested (requires confirm)", async () => {
      const node = {
        id: "node-1",
        resource: "user",
        hash: "hash-1",
        kind: "fact",
        label: "Incorrect fact",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      mockGetNode.mockResolvedValue(node);
      mockArchiveNodes.mockResolvedValue(1);
      mockCreateCorrection.mockResolvedValue({ id: "correction-1" });

      const input: KnowledgeCorrectInput = {
        nodeId: "node-1",
        resource: "user",
        confirm: true,
        correction: {
          type: "delete",
          reason: "Incorrect fact",
        },
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeCorrect.execute({ input });

      expect(result.corrected).toBe(true);
      expect(mockArchiveNodes).toHaveBeenCalledWith(
        ["node-1"],
        "Incorrect fact"
      );
      expect(result.correctionId).toBe("correction-1");
    });

    it("rejects delete when confirm flag is missing", async () => {
      const input: KnowledgeCorrectInput = {
        nodeId: "node-1",
        resource: "user",
        correction: {
          type: "delete",
          reason: "Bad fact",
        },
        authz: "Bearer test-token",
      };

      await expect(toolKnowledgeCorrect.execute({ input })).rejects.toThrow(
        "knowledge_correct_confirmation_required"
      );
    });

    it("updates an edge metadata via metadataPatch", async () => {
      const edge = {
        id: "edge-1",
        resource: "user",
        hash: "edge-hash-1",
        fromId: "node-1",
        toId: "node-2",
        kind: "relates_to",
        weight: 1,
        metadata: { weightHint: 0.1 },
        created: new Date(),
      };

      mockGetEdge.mockResolvedValue(edge);
      mockUpsertEdges.mockResolvedValue([
        { ...edge, metadata: { weightHint: 0.1, note: "corrected" } },
      ]);
      mockCreateCorrection.mockResolvedValue({ id: "correction-1" });

      const input: KnowledgeCorrectInput = {
        edgeId: "edge-1",
        resource: "user",
        correction: {
          type: "update",
          reason: "Fix relation metadata",
          metadataPatch: { note: "corrected" },
        },
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeCorrect.execute({ input });

      expect(result.corrected).toBe(true);
      expect(result.edgeId).toBe("edge-1");
      expect(result.correctionId).toBe("correction-1");
      expect(mockUpsertEdges).toHaveBeenCalledTimes(1);
    });

    it("supports factId lookup via findNodeByHash", async () => {
      const node = {
        id: "node-1",
        resource: "user",
        hash: "fact-hash",
        kind: "fact",
        label: "Old fact",
        properties: {},
        created: new Date(),
        updated: new Date(),
      };

      mockFindNodeByHash.mockResolvedValue(node);
      mockUpdateNode.mockResolvedValue({ ...node, label: "New fact" });
      mockCreateCorrection.mockResolvedValue({ id: "correction-1" });

      const input: KnowledgeCorrectInput = {
        factId: "fact-hash",
        resource: "user",
        correction: {
          type: "update",
          newValue: "New fact",
          reason: "Fix value",
        },
        authz: "Bearer test-token",
      };

      const result = await toolKnowledgeCorrect.execute({ input });

      expect(result.corrected).toBe(true);
      expect(mockFindNodeByHash).toHaveBeenCalledWith("user", "fact-hash");
    });

    it("enforces biometric elevation (passkey + elevated)", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test-user",
          scopes: ["knowledge.write"],
          elevated: false,
          mfa: "none",
        },
      });

      const input: KnowledgeCorrectInput = {
        nodeId: "node-1",
        resource: "user",
        correction: {
          type: "update",
          newValue: "New value",
          reason: "Fix value",
        },
        authz: "Bearer test-token",
      };

      await expect(toolKnowledgeCorrect.execute({ input })).rejects.toThrow(
        "biometric_required"
      );
    });
  });

  describe("Schema Validation", () => {
    it("knowledge_query requires query string", () => {
      const invalid = {};
      const result = toolKnowledgeQuery.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("knowledge_extract requires content and source", () => {
      const invalid = { content: "test" };
      const result = toolKnowledgeExtract.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("knowledge_connect requires fromId and toId", () => {
      const invalid = { fromId: "node-1" };
      const result = toolKnowledgeConnect.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("knowledge_query limit must be positive", () => {
      const invalid = { query: "test", limit: -5 };
      const result = toolKnowledgeQuery.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("knowledge_extract confidence must be between 0 and 1", () => {
      const invalid = { content: "test", source: "test", confidence: 1.5 };
      const result = toolKnowledgeExtract.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("knowledge_connect kind must be valid enum value", () => {
      const invalid = { fromId: "a", toId: "b", kind: "invalid_type" };
      const result = toolKnowledgeConnect.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

afterAll(() => {
  mock.restore();
});
