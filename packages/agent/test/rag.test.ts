import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import type {
  RagDeleteInput,
  RagIngestInput,
  RagListInput,
  RagQueryInput,
} from "../src/orchestrator/tool/rag/definition";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

const mockIngest = mock();
const mockIngestWithOptions = mock();
const mockRetrieve = mock();
const mockGetCurrentModelId = mock(() => "kalm-12b-1024");
mock.module("@alfred/rag", () => ({
  ingest: mockIngest,
  ingestWithOptions: mockIngestWithOptions,
  retrieve: mockRetrieve,
  getCurrentModelId: mockGetCurrentModelId,
}));

const mockCreateDocument = mock();
const mockGetDocument = mock();
const mockListDocuments = mock();
const mockDeleteDocument = mock();
const mockAddChunks = mock();
const mockGetChunks = mock();
const mockSearchChunks = mock();
mock.module("@alfred/db/repo/rag", () => ({
  createDocument: mockCreateDocument,
  getDocument: mockGetDocument,
  listDocuments: mockListDocuments,
  deleteDocument: mockDeleteDocument,
  addChunks: mockAddChunks,
  getChunks: mockGetChunks,
  searchChunks: mockSearchChunks,
}));

// Import tools after mocking
const { toolRagIngest, toolRagQuery, toolRagList, toolRagDelete } =
  await import("../src/orchestrator/tool/rag");

describe("RAG Tools", () => {
  beforeEach(() => {
    resetAuthTokenMocks();
    mockIngest.mockReset();
    mockIngestWithOptions.mockReset();
    mockRetrieve.mockReset();
    mockGetCurrentModelId.mockReset();
    mockGetCurrentModelId.mockReturnValue("kalm-12b-1024");
    mockCreateDocument.mockReset();
    mockGetDocument.mockReset();
    mockListDocuments.mockReset();
    mockDeleteDocument.mockReset();
    mockAddChunks.mockReset();
    mockGetChunks.mockReset();
    mockSearchChunks.mockReset();

    // Default to allowing all policy checks
    mockRequireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["rag.read", "rag.write"],
        elevated: true,
        mfa: "passkey",
      },
    });
  });

  describe("rag_ingest", () => {
    it("ingests document and returns metadata", async () => {
      const documentId = "doc-123";
      const chunks = [
        { id: "chunk-1", content: "hello", order: 0 },
        { id: "chunk-2", content: "world", order: 1 },
      ];

      mockIngest.mockResolvedValue(documentId);
      mockGetChunks.mockResolvedValue(chunks);

      const input: RagIngestInput = {
        source: "test-doc",
        content: "Hello world. This is a test document.",
        authz: "Bearer test-token",
      };

      const result = await toolRagIngest.execute({ input });

      expect(result.documentId).toBe(documentId);
      expect(result.chunks).toBe(2);
      expect(result.source).toBe("test-doc");
      expect(mockIngest).toHaveBeenCalledWith(
        "test-doc",
        "Hello world. This is a test document.",
        expect.any(Function)
      );
    });

    it("enforces rag.write policy", async () => {
      mockRequireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: RagIngestInput = {
        source: "test-doc",
        content: "Test content",
      };

      await expect(toolRagIngest.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });

    it("rejects empty content", () => {
      const input: RagIngestInput = {
        source: "test-doc",
        content: "",
        authz: "Bearer test-token",
      };

      // Schema validation should reject empty content
      const result = toolRagIngest.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects content exceeding max size", async () => {
      // The policy enforcement will throw for content >10MB
      const input: RagIngestInput = {
        source: "test-doc",
        content: "x".repeat(11 * 1024 * 1024), // 11MB
        authz: "Bearer test-token",
      };

      await expect(toolRagIngest.execute({ input })).rejects.toThrow(
        "rag_content_too_large"
      );
    });

    it("ingests with imageUrl for multimodal embedding", async () => {
      const documentId = "doc-multimodal";
      const chunks = [
        { id: "chunk-1", content: "image description", order: 0 },
      ];

      mockIngestWithOptions.mockResolvedValue(documentId);
      mockGetChunks.mockResolvedValue(chunks);

      const input: RagIngestInput = {
        source: "test-image-doc",
        content: "Image description text",
        imageUrl: "https://example.com/image.jpg",
        authz: "Bearer test-token",
      };

      const result = await toolRagIngest.execute({ input });

      expect(result.documentId).toBe(documentId);
      expect(result.chunks).toBe(1);
      expect(mockIngestWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "test-image-doc",
          content: "Image description text",
          imageUrl: "https://example.com/image.jpg",
        })
      );
    });
  });

  describe("rag_query", () => {
    it("returns matching chunks with scores", async () => {
      const mockChunks = [
        {
          content: "Docker is a containerization platform",
          order: 0,
          metadata: {
            documentId: "doc-1",
            source: "docker-docs",
            score: 0.92,
          },
        },
        {
          content: "Docker uses containers to isolate applications",
          order: 1,
          metadata: {
            documentId: "doc-1",
            source: "docker-docs",
            score: 0.85,
          },
        },
      ];

      mockRetrieve.mockResolvedValue(mockChunks);

      const input: RagQueryInput = {
        query: "What is Docker?",
        k: 5,
        threshold: 0.7,
        authz: "Bearer test-token",
      };

      const result = await toolRagQuery.execute({ input });

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].metadata.score).toBe(0.92);
      expect(result.total).toBe(2);
      expect(mockRetrieve).toHaveBeenCalledWith("What is Docker?", 5, 0.7);
    });

    it("filters by source when specified", async () => {
      const mockChunks = [
        {
          content: "Docker content",
          order: 0,
          metadata: { documentId: "doc-1", source: "docker-docs", score: 0.9 },
        },
        {
          content: "React content",
          order: 0,
          metadata: { documentId: "doc-2", source: "react-docs", score: 0.85 },
        },
      ];

      mockRetrieve.mockResolvedValue(mockChunks);

      const input: RagQueryInput = {
        query: "containers",
        source: "docker-docs",
        authz: "Bearer test-token",
      };

      const result = await toolRagQuery.execute({ input });

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.source).toBe("docker-docs");
    });

    it("uses default k and threshold when not specified", async () => {
      mockRetrieve.mockResolvedValue([]);

      const input: RagQueryInput = {
        query: "test query",
        authz: "Bearer test-token",
      };

      await toolRagQuery.execute({ input });

      expect(mockRetrieve).toHaveBeenCalledWith("test query", 10, 0.7);
    });

    it("enforces rag.read policy", async () => {
      mockRequireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: RagQueryInput = {
        query: "test query",
      };

      await expect(toolRagQuery.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });
  });

  describe("rag_list", () => {
    it("returns documents with chunk counts", async () => {
      const mockDocs = [
        {
          id: "doc-1",
          source: "docker-docs",
          created: new Date("2024-01-01"),
        },
        {
          id: "doc-2",
          source: "react-docs",
          created: new Date("2024-01-02"),
        },
      ];

      mockListDocuments.mockResolvedValue(mockDocs);
      mockGetChunks
        .mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }, { id: "c3" }])
        .mockResolvedValueOnce([{ id: "c4" }, { id: "c5" }]);

      const input: RagListInput = {
        authz: "Bearer test-token",
      };

      const result = await toolRagList.execute({ input });

      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].chunkCount).toBe(3);
      expect(result.documents[1].chunkCount).toBe(2);
      expect(result.total).toBe(2);
    });

    it("filters by source pattern", async () => {
      const mockDocs = [
        { id: "doc-1", source: "docker-docs", created: new Date() },
        { id: "doc-2", source: "react-docs", created: new Date() },
        { id: "doc-3", source: "docker-compose", created: new Date() },
      ];

      mockListDocuments.mockResolvedValue(mockDocs);
      mockGetChunks.mockResolvedValue([{ id: "c1" }]);

      const input: RagListInput = {
        source: "docker",
        authz: "Bearer test-token",
      };

      const result = await toolRagList.execute({ input });

      expect(result.documents).toHaveLength(2);
      expect(result.documents.every((d) => d.source.includes("docker"))).toBe(
        true
      );
    });

    it("respects limit parameter", async () => {
      const input: RagListInput = {
        limit: 25,
        authz: "Bearer test-token",
      };

      mockListDocuments.mockResolvedValue([]);

      await toolRagList.execute({ input });

      expect(mockListDocuments).toHaveBeenCalledWith(25);
    });
  });

  describe("rag_delete", () => {
    it("deletes document and returns chunk count", async () => {
      const chunks = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
      mockGetChunks.mockResolvedValue(chunks);
      mockDeleteDocument.mockResolvedValue(1);

      const input: RagDeleteInput = {
        documentId: "doc-123",
        confirm: true,
        authz: "Bearer test-token",
      };

      const result = await toolRagDelete.execute({ input });

      expect(result.deleted).toBe(true);
      expect(result.chunksRemoved).toBe(3);
      expect(mockDeleteDocument).toHaveBeenCalledWith("doc-123");
    });

    it("requires confirmation flag", async () => {
      const input: RagDeleteInput = {
        documentId: "doc-123",
        confirm: false,
        authz: "Bearer test-token",
      };

      await expect(toolRagDelete.execute({ input })).rejects.toThrow(
        "rag_delete_confirmation_required"
      );
    });

    it("returns deleted=false for non-existent document", async () => {
      mockGetChunks.mockResolvedValue([]);
      mockDeleteDocument.mockResolvedValue(0);

      const input: RagDeleteInput = {
        documentId: "non-existent",
        confirm: true,
        authz: "Bearer test-token",
      };

      const result = await toolRagDelete.execute({ input });

      expect(result.deleted).toBe(false);
      expect(result.chunksRemoved).toBe(0);
    });

    it("enforces elevated policy for delete", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test-user",
          scopes: ["rag.write"],
          elevated: false,
          mfa: "none",
        },
      });

      // Policy enforcement should still pass (actual elevation check is in PDP)
      mockGetChunks.mockResolvedValue([]);
      mockDeleteDocument.mockResolvedValue(1);

      const input: RagDeleteInput = {
        documentId: "doc-123",
        confirm: true,
        authz: "Bearer test-token",
      };

      // This test verifies the policy function is called with correct parameters
      await toolRagDelete.execute({ input });

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer test-token",
        ["rag.write"],
        expect.objectContaining({
          action: "rag.delete",
          resource: { kind: "rag", id: "doc-123" },
        })
      );
    });
  });

  describe("Schema Validation", () => {
    it("rag_ingest requires source and content", () => {
      const invalid = {};
      const result = toolRagIngest.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rag_ingest accepts optional imageUrl for multimodal", () => {
      const valid = {
        source: "test-doc",
        content: "Test content",
        imageUrl: "https://example.com/image.jpg",
      };
      const result = toolRagIngest.inputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rag_ingest rejects invalid imageUrl", () => {
      const invalid = {
        source: "test-doc",
        content: "Test content",
        imageUrl: "not-a-url",
      };
      const result = toolRagIngest.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rag_query requires query", () => {
      const invalid = {};
      const result = toolRagQuery.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rag_delete requires documentId", () => {
      const invalid = {};
      const result = toolRagDelete.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rag_query k must be positive integer", () => {
      const invalid = { query: "test", k: -5 };
      const result = toolRagQuery.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rag_query threshold must be between 0 and 1", () => {
      const invalid = { query: "test", threshold: 1.5 };
      const result = toolRagQuery.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

afterAll(() => {
  mock.restore();
});
