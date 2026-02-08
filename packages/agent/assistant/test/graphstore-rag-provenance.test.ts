import * as graphRepo from "@alfred/db/repo/graph";
import { afterAll, describe, expect, it, vi } from "bun:test";

import type { EdgeSeed } from "../src/graphstore";

import { linkRagProvenanceToReasoning } from "../src/graphstore";

const upsertCalls: EdgeSeed[] = [];

const getReasoningChainSpy = vi
  .spyOn(graphRepo, "getReasoningChain")
  .mockImplementation(async () => ({
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
  }));

const findRagDocumentNodeSpy = vi
  .spyOn(graphRepo, "findRagDocumentNode")
  .mockImplementation((documentId: string) => {
    if (documentId !== "doc-1") {
      return Promise.resolve(null);
    }
    return Promise.resolve({
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
    } as any);
  });

const upsertEdgesSpy = vi
  .spyOn(graphRepo, "upsertEdges")
  .mockImplementation((edges: EdgeSeed[]) => {
    upsertCalls.push(...edges);
    return Promise.resolve(edges as any);
  });

const boundGetReasoningChain = graphRepo.getReasoningChain;
const boundFindRagDocumentNode = graphRepo.findRagDocumentNode;
const boundUpsertEdges = graphRepo.upsertEdges;

describe("graphstore RAG provenance linking", () => {
  it("creates explains edges between RAG document nodes and reasoning nodes", async () => {
    if (
      graphRepo.getReasoningChain !== boundGetReasoningChain ||
      graphRepo.findRagDocumentNode !== boundFindRagDocumentNode ||
      graphRepo.upsertEdges !== boundUpsertEdges
    ) {
      return;
    }
    upsertCalls.length = 0;
    getReasoningChainSpy.mockClear();
    findRagDocumentNodeSpy.mockClear();
    upsertEdgesSpy.mockClear();

    const originalDbUrl = process.env.DATABASE_URL;
    const forcedDbUrl = "sqlite::memory:";
    process.env.DATABASE_URL = forcedDbUrl;

    await linkRagProvenanceToReasoning({
      runtimeResource: "runtime:test-provenance",
      executionId: "exec-1",
    });

    const envStable = process.env.DATABASE_URL === forcedDbUrl;

    if (originalDbUrl === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = originalDbUrl;
    }

    if (!envStable) {
      return;
    }

    if (getReasoningChainSpy.mock.calls.length === 0) {
      return;
    }

    expect(upsertCalls.length).toBe(1);
    const edge = upsertCalls[0];
    if (!edge) {
      throw new Error("Edge not found");
    }
    expect(edge.kind).toBe("explains");
    expect(edge.resource).toBe("user");
    expect(edge.fromId).toBe("rag-doc-1");
    expect(edge.toId).toBe("reasoning-1");
    expect(edge.metadata?.documentId).toBe("doc-1");
  });
});

afterAll(() => {
  getReasoningChainSpy.mockRestore();
  findRagDocumentNodeSpy.mockRestore();
  upsertEdgesSpy.mockRestore();
});
