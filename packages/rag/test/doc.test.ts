import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { openai } from "@ai-sdk/openai";

const createDocumentMock = vi.fn();
const addChunksMock = vi.fn();
const searchChunksMock = vi.fn();

// Mock DB repo before importing the module under test to avoid real DB init
mock.module("@alfred/db", () => ({
  ragRepo: {
    createDocument: createDocumentMock,
    addChunks: addChunksMock,
    searchChunks: searchChunksMock,
  },
}));

const embedMock = vi.fn();
const embedManyMock = vi.fn();

mock.module("ai", () => ({
  embed: embedMock,
  embedMany: embedManyMock,
}));

const checkEmbedHealthMock = vi.fn();
const getEmbeddingProviderMock = vi.fn();

mock.module("../src/providers", () => ({
  checkEmbedHealth: checkEmbedHealthMock,
  getEmbeddingProvider: getEmbeddingProviderMock,
}));

let doc: typeof import("../src/doc");

beforeAll(async () => {
  // Import after mocks are in place so doc.ts resolves mocked dependencies
  doc = await import("../src/doc");
});

afterEach(() => {
  vi.restoreAllMocks();
  mock.restore();
});

describe("RAG doc functions", () => {
  describe("chunk", () => {
    it("chunks content by paragraphs", async () => {
      const content = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.";
      const result = await doc.chunk(content, 100);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.length <= 100)).toBe(true);
    });

    it("handles empty content", async () => {
      const result = await doc.chunk("");
      expect(result).toEqual([]);
    });

    it("respects maxChunkSize", async () => {
      const content = "a".repeat(1000);
      const result = await doc.chunk(content, 100);

      expect(result.every((c) => c.length <= 100)).toBe(true);
    });

    it("preserves sentence boundaries when possible", async () => {
      const content = "First sentence. Second sentence. Third sentence.";
      const result = await doc.chunk(content, 50);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("embed", () => {
    it("generates embedding for text", async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => 0.1);
      const mockModel = openai.textEmbeddingModel("text-embedding-3-small");

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: mockModel,
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedMock.mockResolvedValue({
        embedding: mockEmbedding,
      });

      const result = await doc.embed("test text");

      expect(embedMock).toHaveBeenCalledWith({
        model: mockModel,
        value: "test text",
      });
      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(1536);
    });

    it("throws error when provider unhealthy", async () => {
      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(false);

      await expect(doc.embed("test")).rejects.toThrow("rag_provider_unhealthy");
    });

    it("validates embedding dimensions", async () => {
      const invalidEmbedding = Array.from({ length: 100 }, () => 0.1);

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedMock.mockResolvedValue({
        embedding: invalidEmbedding,
      });

      await expect(doc.embed("test")).rejects.toThrow(
        "rag_embed_invalid_vector"
      );
    });
  });

  describe("embedMany", () => {
    it("generates embeddings for multiple texts", async () => {
      const texts = ["text 1", "text 2", "text 3"];
      const mockEmbeddings = texts.map(() =>
        Array.from({ length: 1536 }, () => 0.1)
      );
      const mockModel = openai.textEmbeddingModel("text-embedding-3-small");

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: mockModel,
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedManyMock.mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      const result = await doc.embedMany(texts);

      expect(embedManyMock).toHaveBeenCalledWith({
        model: mockModel,
        values: texts,
      });
      expect(result).toEqual(mockEmbeddings);
      expect(result.length).toBe(texts.length);
    });

    it("returns empty array for empty input", async () => {
      const result = await doc.embedMany([]);
      expect(result).toEqual([]);
    });

    it("validates embedding count matches input", async () => {
      const texts = ["text 1", "text 2"];
      const mockEmbeddings = [Array.from({ length: 1536 }, () => 0.1)];

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedManyMock.mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      await expect(doc.embedMany(texts)).rejects.toThrow("rag_embed_mismatch");
    });
  });

  describe("ingest", () => {
    it("ingests document content", async () => {
      const mockDoc = { id: "doc-id", source: "test", title: "Test" };
      const mockChunks = [
        { id: "chunk-1", content: "chunk 1", order: 0 },
        { id: "chunk-2", content: "chunk 2", order: 1 },
      ];

      createDocumentMock.mockResolvedValue(mockDoc);
      addChunksMock.mockResolvedValue(mockChunks);

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedManyMock.mockResolvedValue({
        embeddings: [
          Array.from({ length: 1536 }, () => 0.1),
          Array.from({ length: 1536 }, () => 0.1),
        ],
      });

      const result = await doc.ingest("test-source", "test content here");

      expect(createDocumentMock).toHaveBeenCalled();
      expect(addChunksMock).toHaveBeenCalled();
      expect(result).toBe("doc-id");
    });

    it("throws error for empty content", async () => {
      await expect(doc.ingest("source", "")).rejects.toThrow("rag_empty_content");
    });

    it("handles batch processing for large documents", async () => {
      const largeContent = "chunk ".repeat(2000);
      const mockDoc = { id: "doc-id", source: "test" };

      createDocumentMock.mockResolvedValue(mockDoc);
      addChunksMock.mockResolvedValue([]);

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedManyMock.mockImplementation(({ values }: { values: string[] }) => {
        return Promise.resolve({
          embeddings: Array.from({ length: values.length }, () =>
            Array.from({ length: 1536 }, () => 0.1)
          ),
        });
      });

      const progressCalls: number[] = [];
      await doc.ingest("source", largeContent, (processed, total) => {
        progressCalls.push(processed);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it("continues on batch embedding failures", async () => {
      const mockDoc = { id: "doc-id", source: "test" };
      createDocumentMock.mockResolvedValue(mockDoc);
      addChunksMock.mockResolvedValue([]);

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedManyMock
        .mockImplementationOnce(() => Promise.reject(new Error("batch failed")))
        .mockImplementation(({ values }: { values: string[] }) => {
          return Promise.resolve({
            embeddings: Array.from({ length: values.length }, () =>
              Array.from({ length: 1536 }, () => 0.1)
            ),
          });
        });

      const content = "chunk ".repeat(1500);
      const result = await doc.ingest("source", content);

      expect(result).toBe("doc-id");
      expect(addChunksMock).toHaveBeenCalled();
    });
  });

  describe("retrieve", () => {
    it("retrieves relevant chunks", async () => {
      const mockResults = [
        {
          id: "chunk-1",
          content: "relevant content",
          order: 0,
          score: 0.9,
          documentId: "doc-1",
          metadata: { source: "test" },
        },
        {
          id: "chunk-2",
          content: "less relevant",
          order: 1,
          score: 0.75,
          documentId: "doc-1",
          metadata: null,
        },
      ];

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedMock.mockResolvedValue({
        embedding: Array.from({ length: 1536 }, () => 0.1),
      });
      searchChunksMock.mockResolvedValue(mockResults);

      const result = await doc.retrieve("test query", 10, 0.7);

      expect(embedMock).toHaveBeenCalled();
      expect(searchChunksMock).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        content: "relevant content",
        metadata: expect.objectContaining({
          score: 0.9,
          documentId: "doc-1",
        }),
      });
    });

    it("returns empty array for empty query", async () => {
      const result = await doc.retrieve("");
      expect(result).toEqual([]);
    });

    it("respects k parameter", async () => {
      const mockResults = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`,
        content: `content ${i}`,
        order: i,
        score: 0.8,
        documentId: "doc-1",
        metadata: null,
      }));

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedMock.mockResolvedValue({
        embedding: Array.from({ length: 1536 }, () => 0.1),
      });
      searchChunksMock.mockResolvedValue(mockResults);

      const result = await doc.retrieve("query", 5, 0.7);

      expect(result).toHaveLength(5);
    });

    it("filters by threshold", async () => {
      const mockResults = [
        {
          id: "chunk-1",
          content: "high score",
          order: 0,
          score: 0.9,
          documentId: "doc-1",
          metadata: null,
        },
        {
          id: "chunk-2",
          content: "low score",
          order: 1,
          score: 0.5,
          documentId: "doc-1",
          metadata: null,
        },
      ];

      getEmbeddingProviderMock.mockReturnValue({
        name: "openai",
        model: openai.textEmbeddingModel("text-embedding-3-small"),
      });
      checkEmbedHealthMock.mockResolvedValue(true);
      embedMock.mockResolvedValue({
        embedding: Array.from({ length: 1536 }, () => 0.1),
      });
      searchChunksMock.mockResolvedValue(mockResults);

      const result = await doc.retrieve("query", 10, 0.7);

      expect(result.every((r) => r.metadata?.score >= 0.7)).toBe(true);
    });
  });
});
