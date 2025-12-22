import { describe, expect, it } from "bun:test";
import {
  GRAPH_DBID_PATTERN,
  buildDbIdToFlowIdMap,
  deriveConfidence,
  deriveWorkflowRunId,
  extractGraphNodeIds,
  extractNodeProperties,
  extractNodeRef,
  graphNodeToKnowledge,
  graphRefToFlowId,
  isValidDbId,
  mapGraphEdgeToFlow,
  type NodeIdRef,
} from "./graph";

describe("Graph Helpers", () => {
  describe("GRAPH_DBID_PATTERN", () => {
    it("matches UUID format", () => {
      // Valid UUID v4 format (version 4, variant 8/9/a/b)
      expect(GRAPH_DBID_PATTERN.test("00000000-0000-4000-8000-000000000001")).toBe(true);
      expect(GRAPH_DBID_PATTERN.test("a1b2c3d4-e5f6-4890-abcd-ef1234567890")).toBe(true);
    });

    it("matches hex format (32 chars)", () => {
      expect(GRAPH_DBID_PATTERN.test("00000000000000000000000000000001")).toBe(true);
      expect(GRAPH_DBID_PATTERN.test("a1b2c3d4e5f67890abcdef1234567890")).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(GRAPH_DBID_PATTERN.test("invalid")).toBe(false);
      expect(GRAPH_DBID_PATTERN.test("")).toBe(false);
      expect(GRAPH_DBID_PATTERN.test("00000000-0000-0000-0000")).toBe(false);
    });
  });

  describe("isValidDbId", () => {
    it("returns true for valid UUIDs", () => {
      expect(isValidDbId("00000000-0000-4000-8000-000000000001")).toBe(true);
    });

    it("returns true for valid hex IDs", () => {
      expect(isValidDbId("a1b2c3d4e5f67890abcdef1234567890")).toBe(true);
    });

    it("returns false for null/undefined", () => {
      expect(isValidDbId(null)).toBe(false);
      expect(isValidDbId(undefined)).toBe(false);
    });

    it("returns false for invalid strings", () => {
      expect(isValidDbId("invalid")).toBe(false);
      expect(isValidDbId("")).toBe(false);
    });
  });

  describe("extractNodeRef", () => {
    it("extracts dbId first", () => {
      const ref: NodeIdRef = { dbId: "db-123", hgHash: "hash-456", uiId: "ui-789" };
      expect(extractNodeRef(ref)).toBe("db-123");
    });

    it("falls back to hgHash", () => {
      const ref: NodeIdRef = { hgHash: "hash-456", uiId: "ui-789" };
      expect(extractNodeRef(ref)).toBe("hash-456");
    });

    it("falls back to uiId", () => {
      const ref: NodeIdRef = { uiId: "ui-789" };
      expect(extractNodeRef(ref)).toBe("ui-789");
    });

    it("returns null for empty object", () => {
      expect(extractNodeRef({})).toBe(null);
    });

    it("returns null for non-object", () => {
      expect(extractNodeRef(null)).toBe(null);
      expect(extractNodeRef(undefined)).toBe(null);
      expect(extractNodeRef("string")).toBe(null);
    });
  });

  describe("extractNodeProperties", () => {
    it("extracts typed properties", () => {
      const props = extractNodeProperties({
        content: "test content",
        confidence: 0.9,
        accuracy: 0.8,
        archived: "2024-01-01",
        executionId: "exec-123",
        runId: "run-456",
        workflowRunId: "wf-789",
      });

      expect(props.content).toBe("test content");
      expect(props.confidence).toBe(0.9);
      expect(props.accuracy).toBe(0.8);
      expect(props.archived).toBe("2024-01-01");
      expect(props.executionId).toBe("exec-123");
      expect(props.runId).toBe("run-456");
      expect(props.workflowRunId).toBe("wf-789");
    });

    it("returns empty object for null/undefined", () => {
      expect(extractNodeProperties(null)).toEqual({});
      expect(extractNodeProperties(undefined)).toEqual({});
    });

    it("ignores non-matching types", () => {
      const props = extractNodeProperties({
        content: 123, // wrong type
        confidence: "high", // wrong type
      });

      expect(props.content).toBeUndefined();
      expect(props.confidence).toBeUndefined();
    });
  });

  describe("deriveConfidence", () => {
    it("returns confidence if present", () => {
      expect(deriveConfidence({ confidence: 0.9 })).toBe(0.9);
    });

    it("falls back to accuracy", () => {
      expect(deriveConfidence({ accuracy: 0.8 })).toBe(0.8);
    });

    it("prefers confidence over accuracy", () => {
      expect(deriveConfidence({ confidence: 0.9, accuracy: 0.8 })).toBe(0.9);
    });

    it("returns undefined if neither present", () => {
      expect(deriveConfidence({})).toBeUndefined();
    });
  });

  describe("deriveWorkflowRunId", () => {
    it("returns executionId first", () => {
      expect(deriveWorkflowRunId({
        executionId: "exec-123",
        runId: "run-456",
        workflowRunId: "wf-789",
      })).toBe("exec-123");
    });

    it("falls back to runId", () => {
      expect(deriveWorkflowRunId({
        runId: "run-456",
        workflowRunId: "wf-789",
      })).toBe("run-456");
    });

    it("falls back to workflowRunId", () => {
      expect(deriveWorkflowRunId({
        workflowRunId: "wf-789",
      })).toBe("wf-789");
    });

    it("returns undefined if none present", () => {
      expect(deriveWorkflowRunId({})).toBeUndefined();
    });

    it("ignores empty strings", () => {
      expect(deriveWorkflowRunId({
        executionId: "",
        runId: "",
        workflowRunId: "wf-789",
      })).toBe("wf-789");
    });
  });

  describe("graphNodeToKnowledge", () => {
    it("transforms graph node to KnowledgeNodeData", () => {
      const node = {
        id: { dbId: "db-123", hgHash: "hash-456" },
        label: "Test Node",
        kind: "fact",
        properties: {
          content: "Test content",
          confidence: 0.9,
        },
      };

      const result = graphNodeToKnowledge(node, "runtime", "user");

      expect(result).not.toBeNull();
      expect(result?.type).toBe("knowledge");
      expect(result?.label).toBe("Test Node");
      expect(result?.kind).toBe("fact");
      expect(result?.summary).toBe("Test content");
      expect(result?.confidence).toBe(0.9);
      expect(result?.source).toBe("runtime");
      expect(result?.graph?.dbId).toBe("db-123");
      expect(result?.graph?.hgHash).toBe("hash-456");
      expect(result?.graph?.resource).toBe("user");
    });

    it("returns null for node without ref", () => {
      const node = { id: {}, label: "Test" };
      expect(graphNodeToKnowledge(node, "rag")).toBeNull();
    });

    it("uses default label for RAG source", () => {
      const node = { id: { dbId: "db-123" } };
      const result = graphNodeToKnowledge(node, "rag");
      expect(result?.label).toBe("RAG Context");
    });
  });

  describe("graphRefToFlowId", () => {
    it("generates RAG flow ID", () => {
      expect(graphRefToFlowId("db-123", "rag")).toBe("rag-knowledge-db-123");
    });

    it("generates runtime flow ID", () => {
      expect(graphRefToFlowId("db-123", "runtime")).toBe("knowledge-db-123");
    });
  });

  describe("mapGraphEdgeToFlow", () => {
    it("maps edge with valid source and target", () => {
      const dbIdToFlowId = new Map([
        ["from-db", "from-flow"],
        ["to-db", "to-flow"],
      ]);

      const result = mapGraphEdgeToFlow(
        { id: "edge-1", fromId: "from-db", toId: "to-db", kind: "relates_to" },
        dbIdToFlowId
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("edge-1");
      expect(result?.source).toBe("from-flow");
      expect(result?.target).toBe("to-flow");
      expect(result?.data.kind).toBe("relates_to");
      expect(result?.animated).toBe(true);
    });

    it("applies explains styling", () => {
      const dbIdToFlowId = new Map([
        ["from-db", "from-flow"],
        ["to-db", "to-flow"],
      ]);

      const result = mapGraphEdgeToFlow(
        { id: "edge-1", fromId: "from-db", toId: "to-db", kind: "explains" },
        dbIdToFlowId
      );

      expect(result?.animated).toBe(false);
      expect(result?.style.strokeDasharray).toBe("4 2");
    });

    it("returns null for missing source", () => {
      const dbIdToFlowId = new Map([["to-db", "to-flow"]]);
      const result = mapGraphEdgeToFlow(
        { id: "edge-1", fromId: "from-db", toId: "to-db" },
        dbIdToFlowId
      );
      expect(result).toBeNull();
    });

    it("returns null for missing target", () => {
      const dbIdToFlowId = new Map([["from-db", "from-flow"]]);
      const result = mapGraphEdgeToFlow(
        { id: "edge-1", fromId: "from-db", toId: "to-db" },
        dbIdToFlowId
      );
      expect(result).toBeNull();
    });
  });

  describe("buildDbIdToFlowIdMap", () => {
    it("builds map from nodes with graph dbIds", () => {
      const nodes = [
        { id: "flow-1", data: { graph: { dbId: "db-1" } } },
        { id: "flow-2", data: { graph: { dbId: "db-2" } } },
        { id: "flow-3", data: {} }, // no graph
      ];

      const map = buildDbIdToFlowIdMap(nodes);

      expect(map.size).toBe(2);
      expect(map.get("db-1")).toBe("flow-1");
      expect(map.get("db-2")).toBe("flow-2");
    });

    it("ignores nodes without dbId", () => {
      const nodes = [
        { id: "flow-1", data: { graph: {} } },
        { id: "flow-2" },
      ];

      const map = buildDbIdToFlowIdMap(nodes);
      expect(map.size).toBe(0);
    });
  });

  describe("extractGraphNodeIds", () => {
    it("extracts valid dbIds from nodes", () => {
      const nodes = [
        { data: { graph: { dbId: "00000000-0000-4000-8000-000000000001" } } },
        { data: { graph: { dbId: "a1b2c3d4e5f67890abcdef1234567890" } } },
        { data: { graph: { dbId: "invalid" } } }, // invalid format
        { data: {} }, // no graph
      ];

      const ids = extractGraphNodeIds(nodes);

      expect(ids).toHaveLength(2);
      expect(ids).toContain("00000000-0000-4000-8000-000000000001");
      expect(ids).toContain("a1b2c3d4e5f67890abcdef1234567890");
    });

    it("deduplicates IDs", () => {
      const nodes = [
        { data: { graph: { dbId: "00000000-0000-4000-8000-000000000001" } } },
        { data: { graph: { dbId: "00000000-0000-4000-8000-000000000001" } } },
      ];

      const ids = extractGraphNodeIds(nodes);
      expect(ids).toHaveLength(1);
    });

    it("returns empty array for nodes without valid dbIds", () => {
      const nodes = [{ data: {} }, { data: { graph: {} } }];
      expect(extractGraphNodeIds(nodes)).toHaveLength(0);
    });
  });
});
