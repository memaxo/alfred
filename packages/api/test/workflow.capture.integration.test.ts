const USE_EXISTING_DB =
  process.env.WORKFLOW_CAPTURE_TEST_USE_EXISTING_DB === "1";
const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_USE_WORKFLOW_RUNTIME = process.env.USE_WORKFLOW_RUNTIME;
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_TRPC_METRICS = process.env.DISABLE_TRPC_METRICS;
const ORIGINAL_HOOK_METRICS = process.env.DISABLE_METRICS_HOOKS;

if (!USE_EXISTING_DB) {
  process.env.DATABASE_URL = "sqlite::memory:";
}
process.env.USE_WORKFLOW_RUNTIME = "true";
process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import { eq } from "drizzle-orm";
import { toObservable } from "./utils/stream";
import "./utils/mock-metrics";
import {
  createWorkflowCaller,
  type WorkflowTestUser,
} from "./utils/workflow-caller";

const createRuntimeMock = vi.fn();

mock.module("@alfred/runtime", () => ({
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
  id: "workflow-capture-user",
  email: "workflow.capture@test.local",
  name: "Workflow Capture",
  roles: ["owner"],
  scopes: [
    "workflow.plan",
    "workflow.stream",
    "workflow.resume",
    "workflow.read",
  ],
};

let persistReasoning: typeof import("../../agent/assistant/src/graphstore.ts").persistReasoning;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;
let memoryEdges: typeof import("@alfred/db/schema/graph").memoryEdges;
let workflowRunsTable: typeof import("@alfred/db/schema/workflow").workflowRuns;
let workflowEventsTable: typeof import("@alfred/db/schema/workflow").workflowEvents;
let conversationsTable: typeof import("@alfred/db/schema/conversation").conversations;
let messagesTable: typeof import("@alfred/db/schema/conversation").messages;

describe("workflow capture integration (sqlite)", () => {
  beforeAll(async () => {
    ({ persistReasoning } = await import(
      "../../agent/assistant/src/graphstore.ts"
    ));
    const dbModule = await import("@alfred/db");
    db = dbModule.db;
    const graphSchema = await import("@alfred/db/schema/graph");
    memoryNodes = graphSchema.memoryNodes;
    memoryEdges = graphSchema.memoryEdges;
    const workflowSchema = await import("@alfred/db/schema/workflow");
    workflowRunsTable = workflowSchema.workflowRuns;
    workflowEventsTable = workflowSchema.workflowEvents;
    const conversationSchema = await import("@alfred/db/schema/conversation");
    conversationsTable = conversationSchema.conversations;
    messagesTable = conversationSchema.messages;
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
  });

  afterEach(async () => {
    createRuntimeMock.mockReset();
    await db.delete(memoryEdges).execute();
    await db.delete(memoryNodes).execute();
    await db.delete(workflowEventsTable).execute();
    await db.delete(workflowRunsTable).execute();
    await db.delete(messagesTable).execute();
    await db.delete(conversationsTable).execute();
  });

  it("persists capture reasoning via workflow stream and reloads chain", async () => {
    const startCaller = await createWorkflowCaller({ user: TEST_USER });
    const streamCaller = await createWorkflowCaller({ user: TEST_USER });
    const resumeCaller = await createWorkflowCaller({ user: TEST_USER });
    const reasoningCaller = await createWorkflowCaller({ user: TEST_USER });

    const startRunId = `start-run-${Date.now()}`;
    createRuntimeMock.mockImplementationOnce(() =>
      createStartExecutor(startRunId)
    );

    const startResult = await startCaller.start({
      requirement: "bootstrap workflow",
      auto: "low",
    });

    expect(startResult.runId).toBe(startRunId);
    expect(createRuntimeMock).toHaveBeenCalledTimes(1);

    const streamRunId = `capture-run-${Date.now()}`;
    const resource = `workspace-capture-${Date.now()}`;
    const now = Date.now() + 5000;
    const traces = [
      { text: "Capture context established", timestamp: now },
      {
        text: "Persisted reasoning chain for capture",
        timestamp: now + 5,
      },
    ];

    createRuntimeMock.mockImplementationOnce(() =>
      createStreamingExecutor({
        runId: streamRunId,
        resource,
        traces,
        auto: "low",
      })
    );

    const events: WorkflowEvent[] = [];
    const resumeCalls: Promise<void>[] = [];
    let observedRunId: string | null = null;

    const subscription = await streamCaller.stream({
      requirement: "end-to-end capture",
      auto: "low",
      workspace: resource,
      cw: resource,
    });
    const streamObservable = toObservable(subscription);

    await new Promise<void>((resolve, reject) => {
      streamObservable.subscribe({
        next: (event) => {
          events.push(event);
          if (event.type === "run" && typeof (event as any).id === "string") {
            observedRunId = (event as any).id;
          }
          if (event.type === "require-scope") {
            const runId = observedRunId ?? streamRunId;
            resumeCalls.push(
              resumeCaller.resume({
                runId,
                event: "bio-authz",
                authz: "passkey:test",
              })
            );
          }
        },
        error: reject,
        complete: resolve,
      });
    });

    await Promise.all(resumeCalls);

    expect(observedRunId).toBe(streamRunId);
    expect(
      events.some(
        (event) => event.type === "progress" && (event as any).pct === 100
      )
    ).toBe(true);

    const runRows = await db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.id, streamRunId));
    expect(runRows[0]?.status).toBe("completed");

    const nodeRows = await db
      .select()
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));
    expect(nodeRows.length).toBeGreaterThan(0);

    const edgeRows = await db
      .select()
      .from(memoryEdges)
      .where(eq(memoryEdges.resource, resource));
    expect(edgeRows.length).toBeGreaterThan(0);

    const conversationRows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.workflowId, streamRunId));
    expect(conversationRows.length).toBeGreaterThanOrEqual(1);

    const conversationId = conversationRows[0]?.id;
    expect(conversationId).toBeTruthy();

    if (!conversationId) {
      throw new Error("conversationId is null");
    }

    const messageRows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId));
    expect(messageRows.length).toBeGreaterThanOrEqual(2);

    const reasoningResult = await reasoningCaller.reasoning({
      runId: streamRunId,
    });

    expect(reasoningResult.runId).toBe(streamRunId);
    expect(reasoningResult.chain.length).toBeGreaterThanOrEqual(2);
    expect(reasoningResult.chain[0]?.text).toContain("Capture context");
    expect(
      reasoningResult.chain.some((step) =>
        step.text.includes("Persisted reasoning chain")
      )
    ).toBe(true);
  });
});

type StreamingExecutorOptions = {
  runId: string;
  resource: string;
  traces: Array<{ text: string; timestamp: number }>;
  auto: "read" | "low" | "medium" | "high";
};

function createStartExecutor(runId: string) {
  const stream = (async function* () {
    yield { type: "run", id: runId } as WorkflowEvent;
    yield {
      type: "progress",
      pct: 100,
      message: "start_complete",
    } as WorkflowEvent;
  })();

  return {
    runId,
    summary: "start-only",
    stream,
    resume: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  };
}

function createStreamingExecutor(options: StreamingExecutorOptions) {
  const { runId, resource, traces, auto } = options;
  const resumeGate = deferred<{ event: string; authz: string }>();

  const stream = (async function* () {
    yield { type: "run", id: runId } as WorkflowEvent;
    await persistReasoning(resource, traces, {
      executionId: runId,
      auto,
    });
    yield {
      type: "context",
      phase: "capture",
      message: "knowledge_persisted",
    } as WorkflowEvent;
    yield {
      type: "assistant",
      text: "Captured context and persisted knowledge",
    } as WorkflowEvent;
    yield {
      type: "require-scope",
      scopes: ["workflow.resume"],
      event: "bio-authz",
    } as WorkflowEvent;
    const resumeData = await resumeGate.promise;
    yield {
      type: "notice",
      message: `resume_ack:${resumeData.authz}`,
    } as WorkflowEvent;
    yield { type: "progress", pct: 100, message: "completed" } as WorkflowEvent;
  })();

  return {
    runId,
    summary: "capture-stream",
    stream,
    resume: async (resumeData: { event: string; authz: string }) => {
      resumeGate.resolve(resumeData);
    },
    cancel: () => {
      resumeGate.reject(new Error("cancelled"));
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
