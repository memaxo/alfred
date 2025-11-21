import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { rerank } from "../src/rerank";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.COHERE_API_KEY;

const sampleDocs = [
  { id: "a", text: "alpha" },
  { id: "b", text: "beta" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
  }
  if (originalApiKey === undefined) {
    process.env.COHERE_API_KEY = undefined;
  } else {
    process.env.COHERE_API_KEY = originalApiKey;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
  }
  if (originalApiKey === undefined) {
    process.env.COHERE_API_KEY = undefined;
  } else {
    process.env.COHERE_API_KEY = originalApiKey;
  }
});

describe("rerank telemetry", () => {
  it("invokes success telemetry when API key is missing", async () => {
    process.env.COHERE_API_KEY = undefined;
    const onSuccess = vi.fn();

    const results = await rerank({
      query: "alpha",
      documents: sampleDocs,
      telemetry: { onSuccess },
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      docCount: sampleDocs.length,
      model: "rerank-v3.5",
    });
    expect(results).toHaveLength(sampleDocs.length);
  });

  it("passes telemetry success details when Cohere returns results", async () => {
    process.env.COHERE_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ index: 1, relevance_score: 0.9 }],
      }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onSuccess = vi.fn();
    const results = await rerank({
      query: "alpha",
      documents: sampleDocs,
      telemetry: { onSuccess },
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
    expect(results[0]?.id).toBe("b");
  });

  it("invokes error telemetry when API call fails", async () => {
    process.env.COHERE_API_KEY = "test-key";
    const failure = new Error("cohere_down");
    const fetchMock = vi.fn().mockRejectedValue(failure);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onError = vi.fn();
    const results = await rerank({
      query: "alpha",
      documents: sampleDocs,
      telemetry: { onError },
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({
      error: failure,
      docCount: sampleDocs.length,
    });
    expect(results).toHaveLength(sampleDocs.length);
  });
});
