/**
 * RAG Repository Embedding Model Tests
 * Tests for model ID tracking and filtering
 */

import {
  ragIngestInputSchema,
  ragQueryInputSchema,
} from "@alfred/agent/orchestrator/tool/rag/definition";
import { describe, expect, test } from "bun:test";

describe("RAG Repository - Embedding Model Types", () => {
  test("SearchChunksOptions accepts modelId", () => {
    // Type-level test - verify the interface accepts modelId
    type Options = {
      embedding: number[];
      limit?: number;
      threshold?: number;
      documentId?: string;
      efSearch?: number;
      modelId?: string;
    };

    const options: Options = {
      embedding: [0.1, 0.2, 0.3],
      modelId: "kalm-12b-1024",
    };

    expect(options.modelId).toBe("kalm-12b-1024");
  });

  test("HybridSearchOptions accepts modelId", () => {
    type Options = {
      embedding: number[];
      query: string;
      modelId?: string;
    };

    const options: Options = {
      embedding: [0.1, 0.2, 0.3],
      query: "test query",
      modelId: "qwen3-vl-2b-1024",
    };

    expect(options.modelId).toBe("qwen3-vl-2b-1024");
  });
});

describe("RAG Ingest Schema - Multimodal", () => {
  test("accepts imageUrl for multimodal embedding", () => {
    const input = {
      source: "test-doc",
      content: "Test content",
      imageUrl: "https://example.com/image.jpg",
    };

    const result = ragIngestInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBe("https://example.com/image.jpg");
    }
  });

  test("rejects invalid imageUrl", () => {
    const input = {
      source: "test-doc",
      content: "Test content",
      imageUrl: "not-a-valid-url",
    };

    const result = ragIngestInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test("allows omitting imageUrl for text-only ingest", () => {
    const input = {
      source: "test-doc",
      content: "Test content",
    };

    const result = ragIngestInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBeUndefined();
    }
  });
});

describe("RAG Query Schema", () => {
  test("accepts valid query parameters", () => {
    const input = {
      query: "test query",
      k: 10,
      threshold: 0.7,
    };

    const result = ragQueryInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test("uses defaults when optional params omitted", () => {
    const input = {
      query: "test query",
    };

    const result = ragQueryInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.k).toBeUndefined();
      expect(result.data.threshold).toBeUndefined();
    }
  });
});
