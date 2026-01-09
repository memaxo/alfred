// SKIP: This test uses mock.module() extensively which causes pollution issues
// when run alongside other tests. The mocks for @alfred/runtime, @alfred/db/repo/policy,
// and other modules don't properly isolate when combined with other test files.
// TODO: Refactor to use dependency injection instead of mock.module()

// Import Redis mocks BEFORE any other imports
import "@alfred/test-kit/redis";

const USE_EXISTING_DB =
  process.env.WORKFLOW_RUNTIME_STREAM_TEST_USE_EXISTING_DB === "1";
const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_USE_WORKFLOW_RUNTIME = process.env.USE_WORKFLOW_RUNTIME;
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_TRPC_METRICS = process.env.DISABLE_TRPC_METRICS;
const ORIGINAL_HOOK_METRICS = process.env.DISABLE_METRICS_HOOKS;
const ORIGINAL_RAG_ENRICH = process.env.RAG_ENRICH_GRAPH;

if (!USE_EXISTING_DB) {
  process.env.DATABASE_URL = "sqlite::memory:";
}
process.env.USE_WORKFLOW_RUNTIME = "true";
process.env.RAG_ENRICH_GRAPH = "1";
process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import {
  afterAll,
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
import type { WorkflowEvent } from "@alfred/type";
import { eq } from "drizzle-orm";
import { toObservable } from "./utils/stream";
import "./utils/mock-metrics";
import {
  createWorkflowCaller,
  type WorkflowTestUser,
} from "./utils/workflow-caller";

const createRuntimeMock = vi.fn();

const runtimeAbs = new URL("../../runtime/src/index.ts", import.meta.url)
  .pathname;
const realRuntime = await import(runtimeAbs);
mock.module("@alfred/runtime", () => ({
  ...realRuntime,
  createRuntime: (...args: unknown[]) => createRuntimeMock(...args),
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));

mock.module("@alfred/agent/orchestrator/linear", () => ({
  emitLinearActivity: async () => {},
  setLinearDelegate: () => {},
  setLinearSessionExternalUrl: () => {},
  setLinearStarted: () => {},
  setLinearCompleted: () => {},
  setLinearCancelled: () => {},
  commentOnLinearIssue: () => {},
  extractIssueIdFromSession: () => null,
}));

mock.module("@alfred/agent/orchestrator/linearmetrics", () => ({
  configureLinearMetrics: () => {},
}));

const TEST_USER: WorkflowTestUser = {
  id: "workflow-runtime-stream-user",
  email: "workflow.runtime.stream@test.local",
  name: "Workflow Runtime Stream",
  roles: ["owner"],
  scopes: [
    "workflow.plan",
    "workflow.stream",
    "workflow.resume",
    "workflow.read",
    "graph.read",
  ],
};

let ingest: typeof import("@alfred/rag").ingest;
let setEmbeddingProvider: typeof import("@alfred/rag").setEmbeddingProvider;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let workflowRunsTable: typeof import("@alfred/db/schema/workflow").workflowRuns;
let workflowEventsTable: typeof import("@alfred/db/schema/workflow").workflowEvents;

// biome-ignore lint/suspicious/noSkippedTests: Known test isolation issue with mock.module()
describe.skip("workflow runtime stream provenance (sqlite)", () => {
  beforeAll(async () => {
    const ragModule = await import("@alfred/rag");
    ingest = ragModule.ingest;
    setEmbeddingProvider = ragModule.setEmbeddingProvider;

    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const graphSchema = await import("@alfred/db/schema/graph");
    memoryNodes = graphSchema.memoryNodes;
    memoryEdges = graphSchema.memoryEdges;
    const workflowSchema = await import("@alfred/db/schema/workflow");
    workflowRunsTable = workflowSchema.workflowRuns;
    workflowEventsTable = workflowSchema.workflowEvents;
  });

  afterAll(() => {
    if (!USE_EXISTING_DB) {
      if (ORIGINAL_DB_URL === undefined) {
        process.env.DATABASE_URL = undefined;
      } else {
        process.env.DATABASE_URL = ORIGINAL_DB_URL;
      }
    }
    if (ORIGINAL_USE_WORKFLOW_RUNTIME === undefined) {
      process.env.USE_WORKFLOW_RUNTIME = undefined;
    } else {
      process.env.USE_WORKFLOW_RUNTIME = ORIGINAL_USE_WORKFLOW_RUNTIME;
    }
    if (ORIGINAL_OPENAI_KEY === undefined) {
      process.env.OPENAI_API_KEY = undefined;
    } else {
      process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY;
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
    if (ORIGINAL_RAG_ENRICH === undefined) {
      process.env.RAG_ENRICH_GRAPH = undefined;
    } else {
      process.env.RAG_ENRICH_GRAPH = ORIGINAL_RAG_ENRICH;
    }
  });

  beforeEach(() => {
    // Stub embeddings to avoid heavy local models
    setEmbeddingProvider({
      embed: async () => Array.from({ length: EMBEDDING_DIM }, () => 0.1),
      embedMany: async (texts: string[]) =>
        texts.map(() => Array.from({ length: EMBEDDING_DIM }, () => 0.1)),
    });
  });

  afterEach(async () => {
    createRuntimeMock.mockReset();
    setEmbeddingProvider(null);
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
    await db.delete(workflowEventsTable).execute();
    await db.delete(workflowRunsTable).execute();
  });

  it("persists runtime reasoning with ragDocumentIds and links explains edges via workflow.stream", async () => {
    const streamCaller = await createWorkflowCaller({ user: TEST_USER });
    const reasoningCaller = await createWorkflowCaller({ user: TEST_USER });

    const source = `runtime-stream-prov-${Date.now()}`;
    const content = [
      "Runtime stream provenance test document.",
      "This text will be embedded and enriched into the hypergraph.",
    ].join(" ");

    const documentId = await ingest(source, content);

    const runId = `runtime-stream-run-${Date.now()}`;
    const resource = `workspace-runtime-stream-${Date.now()}`;
    const now = Date.now();
    const traces = [
      {
        text: "Runtime reasoning step one from stream.",
        timestamp: now,
      },
      {
        text: "Runtime reasoning step two informed by RAG.",
        timestamp: now + 5,
      },
    ];

    createRuntimeMock.mockImplementationOnce(() =>
      createRuntimeExecutor({
        runId,
        ragDocumentId: documentId,
        traces,
      })
    );

    const events: WorkflowEvent[] = [];
    const subscription = await streamCaller.stream({
      requirement: "runtime provenance e2e",
      auto: "low",
      workspace: resource,
      cw: resource,
    });

    const streamObservable = toObservable(subscription);

    await new Promise<void>((resolve, reject) => {
      streamObservable.subscribe({
        next: (event) => {
          events.push(event);
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(
      events.some(
        (event) =>
          event._ === "progress" &&
          (event as any).pct === 100 &&
          (event as any).message === "completed"
      )
    ).toBe(true);

    const runRows = await db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.id, runId));
    expect(runRows[0]?.status).toBe("completed");

    // Reasoning API should be able to reload the chain for this run
    const reasoningResult = await reasoningCaller.reasoning({ runId });
    expect(reasoningResult.runId).toBe(runId);
    expect(reasoningResult.chain.length).toBeGreaterThanOrEqual(2);
  });
});

type RuntimeExecutorOptions = {
  runId: string;
  ragDocumentId: string;
  traces: Array<{ text: string; timestamp: number }>;
};

function createRuntimeExecutor(options: RuntimeExecutorOptions) {
  const { runId, ragDocumentId, traces } = options;

  const stream = (async function* () {
    await Promise.resolve();
    yield { _: "run", id: runId } as WorkflowEvent;

    // Emit runtime context with ragDocumentIds so the router can attach provenance
    yield {
      _: "event",
      kind: "runtime-context",
      data: { ragDocumentIds: [ragDocumentId] },
    } as any;

    // Emit explicit reasoning events so the router accumulates traces
    for (const trace of traces) {
      yield {
        _: "reasoning",
        text: trace.text,
        timestamp: trace.timestamp,
      } as any;
    }

    yield {
      _: "progress",
      pct: 100,
      message: "completed",
    } as WorkflowEvent;
  })();

  return {
    runId,
    summary: "runtime-stream-provenance",
    stream,
    resume: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  };
}
