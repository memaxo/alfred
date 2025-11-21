import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { EMBEDDING_DIM } from "@alfred/embed";

const createDocumentMock = vi.fn();
const addChunksMock = vi.fn();
const searchChunksMock = vi.fn();

mock.module("@alfred/db", () => ({
  ragRepo: {
    createDocument: createDocumentMock,
    addChunks: addChunksMock,
    searchChunks: searchChunksMock,
  },
}));

let doc: typeof import("../src/doc");

beforeAll(async () => {
  doc = await import("../src/doc");
});

const makeEmbeddingProvider = () => ({
  embed: vi.fn(async () => Array.from({ length: EMBEDDING_DIM }, () => 0.1)),
  embedMany: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: EMBEDDING_DIM }, () => 0.2))
  ),
});

let providerMocks: ReturnType<typeof makeEmbeddingProvider>;

beforeEach(() => {
  createDocumentMock.mockReset();
  addChunksMock.mockReset();
  searchChunksMock.mockReset();
  providerMocks = makeEmbeddingProvider();
  doc.setEmbeddingProvider(providerMocks);
});

afterEach(() => {
  doc.setEmbeddingProvider(null);
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
  });

  describe("embed", () => {
    it("delegates to active provider", async () => {
      const vector = await doc.embed("test text");
      expect(providerMocks.embed).toHaveBeenCalledWith("test text");
      expect(vector).toHaveLength(EMBEDDING_DIM);
    });

    it("validates embedding dimensions", async () => {
      doc.setEmbeddingProvider({
        embed: async () => Array.from({ length: 10 }, () => 0.1),
        embedMany: providerMocks.embedMany,
      });
      await expect(doc.embed("test")).rejects.toThrow(
        "rag_embed_invalid_vector"
      );
    });
  });

  describe("embedMany", () => {
    it("returns embeddings for multiple texts", async () => {
      const texts = ["text 1", "text 2"];
      const embeddings = await doc.embedMany(texts);
      expect(providerMocks.embedMany).toHaveBeenCalledWith(texts);
      expect(embeddings).toHaveLength(texts.length);
    });

    it("validates embedding count matches input", async () => {
      doc.setEmbeddingProvider({
        embed: providerMocks.embed,
        embedMany: async () => [
          Array.from({ length: EMBEDDING_DIM }, () => 0.1),
        ],
      });
      await expect(doc.embedMany(["a", "b"])).rejects.toThrow(
        "rag_embed_mismatch"
      );
    });
  });

  describe("ingest", () => {
    it("ingests document content and stores chunks", async () => {
      const mockDoc = { id: "doc-id", source: "test", title: "Test" };
      createDocumentMock.mockResolvedValue(mockDoc);
      addChunksMock.mockResolvedValue([]);

      const docId = await doc.ingest(
        "test-source",
        "content one\n\ncontent two"
      );

      expect(docId).toBe("doc-id");
      expect(createDocumentMock).toHaveBeenCalled();
      expect(addChunksMock).toHaveBeenCalled();
      expect(providerMocks.embedMany).toHaveBeenCalled();
    });

    it("skips empty content", async () => {
      await expect(doc.ingest("test", " ")).rejects.toThrow(
        "rag_empty_content"
      );
    });
  });

  describe("retrieve", () => {
    it("retrieves relevant chunks", async () => {
      searchChunksMock.mockResolvedValue([
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Chunk content",
          order: 0,
          metadata: { page: 1 },
          score: 0.9,
        },
      ]);

      const results = await doc.retrieve("alpha", 3, 0.5);

      expect(providerMocks.embed).toHaveBeenCalledWith("alpha");
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.score).toBe(0.9);
    });

    it("returns empty array when query blank", async () => {
      const results = await doc.retrieve(" ");
      expect(results).toEqual([]);
      expect(providerMocks.embed).not.toHaveBeenCalled();
    });
  });
});
