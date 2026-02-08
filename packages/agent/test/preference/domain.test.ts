import type { UIMessage } from "@alfred/type/stream";

import { describe, expect, it, mock } from "bun:test";

const mockEmbedMany = mock();
mock.module("@alfred/rag", () => ({
  embedMany: mockEmbedMany,
}));

const mockCosineSimilarity = mock();
mock.module("@alfred/embed", () => ({
  cosineSimilarity: mockCosineSimilarity,
}));

mock.module("@alfred/logger", () => ({
  logger: {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

const { detectDomain } = await import("../../src/preference/domain");

describe("detectDomain", () => {
  it("returns domain from tool name prefix without embedding", async () => {
    const result = await detectDomain([], ["git.status"]);
    expect(result).toBe("git");
    expect(mockEmbedMany).not.toHaveBeenCalled();
  });

  it("classifies domain from message text via embeddings", async () => {
    mockEmbedMany.mockImplementation((texts: string[]) => {
      if (texts.length === 1) {
        // input vector
        return Promise.resolve([[1, 0]]);
      }
      // prototype vectors (shape is irrelevant; cosineSimilarity is mocked)
      return Promise.resolve(texts.map(() => [0, 0]));
    });

    mockCosineSimilarity.mockImplementation((a: number[], b: number[]) => {
      void a;
      // Treat centroid vectors with first element == 1 as "best" (kubernetes).
      return (b[0] ?? 0) === 1 ? 0.9 : 0.1;
    });

    // Force centroids: we simulate this by making the second embedMany call
    // return prototype embeddings that average to [1,0] for kubernetes and [0,1] for others.
    let call = 0;
    mockEmbedMany.mockImplementation((texts: string[]) => {
      call += 1;
      if (call === 1) {
        // input
        return Promise.resolve([[1, 0]]);
      }
      // prototypes: 8 total (2 per domain), in the internal order:
      // proxmox(2), git(2), docker(2), kubernetes(2)
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += 1) {
        if (i >= 6) {
          vectors.push([1, 0]);
        } else {
          vectors.push([0, 1]);
        }
      }
      return Promise.resolve(vectors);
    });

    const messages: UIMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Can you deploy this to the cluster?" }],
      },
    ];

    const result = await detectDomain(messages);
    expect(result).toBe("kubernetes");
    expect(mockEmbedMany).toHaveBeenCalled();
  });
});
