const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_RAG_ENRICH = process.env.RAG_ENRICH_GRAPH;
const ORIGINAL_TRPC_METRICS = process.env.DISABLE_TRPC_METRICS;
const ORIGINAL_HOOK_METRICS = process.env.DISABLE_METRICS_HOOKS;

process.env.DATABASE_URL = "sqlite::memory:";
process.env.RAG_ENRICH_GRAPH = "1";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.OPENAI_API_KEY ??= "test-key";

import { EMBEDDING_DIM } from "@alfred/embed";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { eq } from "drizzle-orm";

let ingest: typeof import("@alfred/rag").ingest;
let workflowProvenance: typeof import("../src/workflow/provenance").workflowProvenance;
let setEmbeddingProvider: typeof import("@alfred/rag").setEmbeddingProvider;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;

describe("workflow runtime provenance integration (sqlite)", () => {
  beforeAll(async () => {
    const ragModule = await import("@alfred/rag");
    ({ ingest } = ragModule);
    ({ setEmbeddingProvider } = ragModule);
    ({ workflowProvenance } = await import("../src/workflow/provenance"));
    const dbModule = await import("@alfred/db");
    ({ db } = dbModule);
    const graphSchema = await import("@alfred/db/schema/graph");
    ({ memoryNodes } = graphSchema);
    ({ memoryEdges } = graphSchema);
  });

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }

    if (ORIGINAL_RAG_ENRICH === undefined) {
      process.env.RAG_ENRICH_GRAPH = undefined;
    } else {
      process.env.RAG_ENRICH_GRAPH = ORIGINAL_RAG_ENRICH;
    }

    if (ORIGINAL_TRPC_METRICS === undefined) {
      process.env.DISABLE_TRPC_METRICS = undefined;
    } else {
      process.env.DISABLE_TRPC_METRICS = ORIGINAL_TRPC_METRICS;
    }

    if (ORIGINAL_HOOK_METRICS === undefined) {
      process.env.DISABLE_METRICS_HOOKS = undefined;
    } else {
      process.env.DISABLE_METRICS_HOOKS = ORIGINAL_HOOK_METRICS;
    }
  });

  beforeEach(() => {
    // Stub embeddings to avoid spinning up heavy local models during tests
    setEmbeddingProvider({
      embed: async () => Array.from({ length: EMBEDDING_DIM }, () => 0.1),
      embedMany: async (texts: string[]) =>
        texts.map(() => Array.from({ length: EMBEDDING_DIM }, () => 0.1)),
    });
  });

  afterEach(async () => {
    setEmbeddingProvider(null);
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
  });

  it("links reasoning nodes to RAG documents via explains edges", async () => {
    const source = `runtime-prov-${Date.now()}`;
    const content = [
      "Runtime provenance test document.",
      "This text will be embedded and enriched into the hypergraph.",
    ].join(" ");

    const documentId = await ingest(source, content);

    const resource = `workspace-runtime-${Date.now()}`;
    const executionId = `runtime-run-${Date.now()}`;
    const now = Date.now();
    const traces = [
      { text: "First runtime reasoning step.", timestamp: now },
      {
        text: "Second runtime reasoning step using RAG context.",
        timestamp: now + 5,
      },
    ];

    await workflowProvenance({
      resource,
      executionId,
      auto: "low",
      threadId: executionId,
      traces,
      context: { ragDocumentIds: [documentId] },
    });

    const ragNodes = await db
      .select()
      .from(memoryNodes)
      .where(eq(memoryNodes.kind, "rag_document"));

    expect(ragNodes.length).toBeGreaterThan(0);

    const ragNode = ragNodes.find((row) => {
      const props = (row.properties ?? null) as Record<string, unknown> | null;
      return props?.documentId === documentId;
    });

    expect(ragNode).toBeTruthy();

    const reasoningNodes = await db
      .select()
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));

    expect(reasoningNodes.length).toBeGreaterThan(0);

    const reasoningNode = reasoningNodes.find((row) => {
      const props = (row.properties ?? null) as {
        ragDocumentIds?: unknown;
      } | null;
      const ids = Array.isArray(props?.ragDocumentIds)
        ? (props?.ragDocumentIds as unknown[])
        : [];
      return ids.includes(documentId);
    });

    expect(reasoningNode).toBeTruthy();

    const explainsEdges = await db
      .select()
      .from(memoryEdges)
      .where(eq(memoryEdges.kind, "explains"));

    expect(explainsEdges.length).toBeGreaterThan(0);

    const explainEdge = explainsEdges.find((edge) => {
      if (!(ragNode && reasoningNode)) {
        return false;
      }
      if (edge.fromId !== ragNode.id || edge.toId !== reasoningNode.id) {
        return false;
      }
      const meta = (edge.metadata ?? null) as Record<string, unknown> | null;
      return meta?.documentId === documentId;
    });

    expect(explainEdge).toBeTruthy();
    expect(explainEdge?.resource).toBe("user");
  });
});
