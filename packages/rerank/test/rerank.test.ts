import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import {
  getRerankBackend,
  isRerankAvailable,
  rerank,
  resolveBackend,
} from "../src/resolve";

// Store original env vars
const originalEnv = {
  RERANK_BACKEND: process.env.RERANK_BACKEND,
  COHERE_API_KEY: process.env.COHERE_API_KEY,
  QWEN3VL_RERANK_URL: process.env.QWEN3VL_RERANK_URL,
};

beforeEach(() => {
  // Clear all relevant env vars
  process.env.RERANK_BACKEND = undefined;
  process.env.COHERE_API_KEY = undefined;
  process.env.QWEN3VL_RERANK_URL = undefined;
});

afterEach(() => {
  // Restore original env vars
  process.env.RERANK_BACKEND = originalEnv.RERANK_BACKEND;
  process.env.COHERE_API_KEY = originalEnv.COHERE_API_KEY;
  process.env.QWEN3VL_RERANK_URL = originalEnv.QWEN3VL_RERANK_URL;
});

describe("resolveBackend", () => {
  it("returns 'none' when no backend is configured", () => {
    expect(resolveBackend()).toBe("none");
  });

  it("returns 'cohere' when COHERE_API_KEY is set", () => {
    process.env.COHERE_API_KEY = "test-key";
    expect(resolveBackend()).toBe("cohere");
  });

  it("returns 'qwen3vl' when QWEN3VL_RERANK_URL is set", () => {
    process.env.QWEN3VL_RERANK_URL = "http://localhost:8200";
    expect(resolveBackend()).toBe("qwen3vl");
  });

  it("prefers COHERE_API_KEY over QWEN3VL_RERANK_URL", () => {
    process.env.COHERE_API_KEY = "test-key";
    process.env.QWEN3VL_RERANK_URL = "http://localhost:8200";
    expect(resolveBackend()).toBe("cohere");
  });

  it("respects explicit RERANK_BACKEND=cohere", () => {
    process.env.RERANK_BACKEND = "cohere";
    expect(resolveBackend()).toBe("cohere");
  });

  it("respects explicit RERANK_BACKEND=qwen3vl", () => {
    process.env.RERANK_BACKEND = "qwen3vl";
    expect(resolveBackend()).toBe("qwen3vl");
  });

  it("respects explicit RERANK_BACKEND=none", () => {
    process.env.COHERE_API_KEY = "test-key"; // Would auto-detect cohere
    process.env.RERANK_BACKEND = "none";
    expect(resolveBackend()).toBe("none");
  });
});

describe("isRerankAvailable", () => {
  it("returns false when no backend configured", () => {
    expect(isRerankAvailable()).toBe(false);
  });

  it("returns true when Cohere is configured", () => {
    process.env.COHERE_API_KEY = "test-key";
    expect(isRerankAvailable()).toBe(true);
  });

  it("returns true when Qwen3-VL is configured", () => {
    process.env.QWEN3VL_RERANK_URL = "http://localhost:8200";
    expect(isRerankAvailable()).toBe(true);
  });
});

describe("getRerankBackend", () => {
  it("returns current backend name", () => {
    expect(getRerankBackend()).toBe("none");

    process.env.COHERE_API_KEY = "test-key";
    expect(getRerankBackend()).toBe("cohere");
  });
});

describe("rerank (fail-open)", () => {
  it("returns empty array when no backend configured", async () => {
    const results = await rerank({
      query: "test query",
      documents: [{ id: "1", text: "test doc" }],
    });

    expect(results).toEqual([]);
  });

  it("calls telemetry.onSuccess even when no backend", async () => {
    const onSuccess = vi.fn();

    await rerank({
      query: "test query",
      documents: [{ id: "1", text: "test doc" }],
      telemetry: { onSuccess },
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      backend: "none",
      docCount: 1,
    });
  });
});
