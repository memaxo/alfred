import {
  describe,
  it,
  expect,
  mock,
  vi,
} from "bun:test";
import type { EdgeSeed } from "../src/graphstore";

const upsertCalls: EdgeSeed[] = [];

mock.module("@alfred/db/repo/graph", () => {
  return {
    getReasoningChain: vi.fn(async () => {
      return {
        nodes: [
          {
            id: "reasoning-1",
            resource: "runtime:test-provenance",
            kind: "reasoning",
            label: "Test reasoning",
            properties: {
              executionId: "exec-1",
              ragDocumentIds: ["doc-1"],
            },
          },
        ],
        edges: [],
      };
    }),
    findRagDocumentNode: vi.fn(async (documentId: string) => {
      if (documentId !== "doc-1") return null;
      return {
        id: "rag-doc-1",
        resource: "user",
        kind: "rag_document",
        label: "Test RAG Document",
        hash: "rag_doc:test-doc",
        properties: {
          documentId,
        },
        created: new Date(),
        updated: new Date(),
        labelTsvector: null,
      } as any;
    }),
    upsertEdges: vi.fn(async (edges: EdgeSeed[]) => {
      upsertCalls.push(...edges);
      return edges as any;
    }),
  };
});

import { linkRagProvenanceToReasoning } from "../src/graphstore";

describe("graphstore RAG provenance linking", () => {
  it("creates explains edges between RAG document nodes and reasoning nodes", async () => {
    upsertCalls.length = 0;

    await linkRagProvenanceToReasoning({
      runtimeResource: "runtime:test-provenance",
      executionId: "exec-1",
    });

    expect(upsertCalls.length).toBe(1);
    const edge = upsertCalls[0]!;
    expect(edge.kind).toBe("explains");
    expect(edge.resource).toBe("user");
    expect(edge.fromId).toBe("rag-doc-1");
    expect(edge.toId).toBe("reasoning-1");
    expect(edge.metadata?.documentId).toBe("doc-1");
  });
});

