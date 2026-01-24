import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { qwen3vlRerank } from "../src/client.js";

let server: ReturnType<typeof Bun.serve> | null = null;
let baseUrl: string | null = null;

describe("qwen3vlRerank (success path)", () => {
  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/health") {
          return Response.json({
            status: "ok",
            model: "Qwen/Qwen3-VL-Reranker-2B",
            device: "cpu",
            batch_size: 4,
          });
        }

        if (url.pathname === "/rerank" && req.method === "POST") {
          return Response.json({
            results: [
              { id: "b", score: 0.9, index: 1 },
              { id: "a", score: 0.1, index: 0 },
            ],
            debug: {
              total_ms: 10,
              build_query_ms: 1,
              split_docs_ms: 1,
              text_only_ms: 7,
              multimodal_ms: 0,
              sort_ms: 1,
              text_batches: [{ start_index: 0, size: 2, ms: 7, seq_len: 42 }],
              multimodal_docs: [],
            },
          });
        }

        return new Response("not_found", { status: 404 });
      },
    });

    baseUrl = `http://127.0.0.1:${server.port}`;
    process.env.QWEN3VL_RERANK_URL = baseUrl;
  });

  afterAll(() => {
    server?.stop(true);
    server = null;
    baseUrl = null;
    process.env.QWEN3VL_RERANK_URL = undefined;
  });

  it("returns results on success", async () => {
    const results = await qwen3vlRerank({
      query: "test query",
      documents: [
        { id: "a", text: "doc a" },
        { id: "b", text: "doc b" },
      ],
      topN: 2,
      debug: true,
    });

    expect(results).toEqual([
      { id: "b", score: 0.9, index: 1 },
      { id: "a", score: 0.1, index: 0 },
    ]);
  });
});
