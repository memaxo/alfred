// Import Redis mocks first - this sets up env vars and mocks before any other imports
import "../redis/index";
import { mock, vi } from "bun:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

import { registerMockReset } from "../bun/preload";
import { createVCR, type VCRRecorder } from "../vcr";

/**
 * VCR Mode Configuration
 *
 * When enabled, AI provider responses are recorded/replayed via VCR
 * instead of using stub mocks. This provides more realistic testing
 * while remaining deterministic.
 *
 * Usage:
 *   const handle = await installWorkflowRuntimeFixture({
 *     vcr: {
 *       cassettePath: path.join(__dirname, '__cassettes__', 'test.json'),
 *       strictReplay: true,
 *     }
 *   });
 */
export interface VCRConfig {
  cassettePath: string;
  strictReplay?: boolean;
}

interface WorkflowRunRecord {
  id: string;
  userId: string;
  workflowId: string;
  status: string;
  inputData?: unknown;
  stateData?: unknown;
  errorMessage?: string | null;
  linearSessionId?: string | null;
  linearSpace?: string | null;
  linearIssueId?: string | null;
  linearIssueUrl?: string | null;
}

interface WorkflowEventRecord {
  runId: string;
  eventId: string;
  eventType: string;
  eventData?: unknown;
  stepId?: string | null;
  timestamp: Date;
}

interface LinearRequest {
  action?: string;
  input: Record<string, unknown>;
}

type StreamMode = "normal" | "error";

export interface WorkflowRuntimeFixtureHandle {
  repo: {
    createRun: ReturnType<typeof vi.fn>;
    updateRun: ReturnType<typeof vi.fn>;
    appendEvent: ReturnType<typeof vi.fn>;
    getRun: ReturnType<typeof vi.fn>;
    listEvents: ReturnType<typeof vi.fn>;
    listEventsByType: ReturnType<typeof vi.fn>;
    listEventsByTypePaged: ReturnType<typeof vi.fn>;
    countEventsByType: ReturnType<typeof vi.fn>;
  };
  runs: Map<string, WorkflowRunRecord>;
  events: WorkflowEventRecord[];
  linearRequests: LinearRequest[];
  linearStubUrl: string;
  setAiStreamMode(mode: StreamMode): void;
  setReviewGateFailure(mode: boolean): void;
  clearRepo(): void;
  clearLinearRequests(): void;
  stop(): Promise<void>;
  /** VCR instance when VCR mode is enabled (null when using stubs) */
  vcr: InstanceType<typeof VCRRecorder> | null;
}

/**
 * Module-level state for workflow runtime fixture.
 * Encapsulated for easier reset between tests.
 */
const fixtureState = {
  aiStreamMode: "normal" as StreamMode,
  reviewGateShouldFail: false,
  activeVcr: null as InstanceType<typeof VCRRecorder> | null,
};

/**
 * Reset all module-level state in the workflow runtime fixture.
 * Called automatically by preload afterEach.
 */
export function resetWorkflowFixtureState(): void {
  fixtureState.aiStreamMode = "normal";
  fixtureState.reviewGateShouldFail = false;
  // Note: activeVcr cleanup is handled by stop() in individual fixtures
  // Setting to null here prevents stale references
  fixtureState.activeVcr = null;
}

// Legacy reference for backwards compatibility in existing code
const aiStreamState = {
  get mode() {
    return fixtureState.aiStreamMode;
  },
  set mode(v: StreamMode) {
    fixtureState.aiStreamMode = v;
  },
};

const realAiModule = await import("ai");
const realOpenAiModule = await import("@ai-sdk/openai");

const workflowMetricNames = [
  "linearActivityDurationSeconds",
  "linearActivityEmissionsTotal",
  "linearSessionOperationsTotal",
  "linearWebhookEventsTotal",
  "linearWebhookWorkflowCancelsTotal",
  "linearWebhookWorkflowStartsTotal",
  "multiAgentAgentDurationSeconds",
  "multiAgentErrorsTotal",
  "multiAgentTasksTotal",
  "multiAgentWavesTotal",
  "replayQueriesTotal",
  "replayQueryDurationSeconds",
  "runnerErrorsTotal",
  "runnerStepsTotal",
  "runRegistryDispatchDurationSeconds",
  "runRegistryEventsTotal",
  "workflowProvenanceDurationSeconds",
  "workflowProvenanceEdgesTotal",
  "workflowStreamDurationSeconds",
  "workflowStreamEventsTotal",
] as const;

const createWorkflowMetric = () => ({
  inc: vi.fn(),
  dec: vi.fn(),
  observe: vi.fn(),
  set: vi.fn(),
  labels: vi.fn(() => createWorkflowMetric()),
  startTimer: vi.fn(() => vi.fn()),
});

export const workflowMetricsStub = Object.fromEntries(
  workflowMetricNames.map((name) => [name, createWorkflowMetric()])
) as Record<
  (typeof workflowMetricNames)[number],
  ReturnType<typeof createWorkflowMetric>
>;

function sortByTimestampDesc(list: WorkflowEventRecord[]) {
  return [...list].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

function sortByTimestampAsc(list: WorkflowEventRecord[]) {
  return [...list].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

mock.module("@ai-sdk/openai", () => ({
  ...realOpenAiModule,
  openai: (modelId: string) => ({ modelId }),
}));

mock.module("@alfred/agent/workflow/metrics", () => workflowMetricsStub);

export const aiStreamTextMock = vi.fn(() => {
  if (aiStreamState.mode === "error") {
    return {
      fullStream: (async function* fullStream() {
        yield* [];
        throw new Error("ai_stub_failure");
      })(),
    };
  }
  return {
    fullStream: (async function* fullStream() {
      yield { type: "text-delta", id: "text-1", delta: "hello" };
      yield { type: "finish", finishReason: "stop" };
    })(),
  };
});

const validateMessagesStub = async ({ messages }: { messages?: unknown[] }) =>
  Array.isArray(messages) ? messages : [];

mock.module("ai", () => ({
  ...realAiModule,
  streamText: aiStreamTextMock,
  validateUIMessages: validateMessagesStub,
}));

const buildHistoryContextMock = vi.fn(
  async ({ messages }: { messages: unknown[] }) => ({
    uiMessages: messages,
    modelMessages: messages,
    droppedMessages: 0,
    keptTokens: 50,
    droppedTokens: 0,
    selection: {
      kept: messages,
      dropped: [],
      tiers: new Map(),
      tierByMessage: new WeakMap(),
      keptTokens: 50,
      droppedTokens: 0,
      budget: {
        modelId: "stub-model",
        maxContextTokens: 4096,
        historyBudgetTokens: 3072,
        systemTokens: 256,
        headroomTokens: 768,
      },
    },
  })
);

mock.module("@alfred/history", () => ({
  buildHistoryContext: buildHistoryContextMock,
  getHistoryBudgetDefaults: () => ({}),
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockImplementation(async () => {}),
}));

mock.module("@alfred/agent/orchestrator/flow/context", () => ({
  gatherCodeContext: async ({
    requirement,
  }: {
    requirement: string;
    userId?: string;
  }) => ({
    code: [
      {
        id: "code:main.ts",
        kind: "code",
        path: "main.ts",
        content: requirement,
        score: 0.92,
      },
    ],
  }),
  gatherWebContext: async ({
    requirement,
  }: {
    requirement: string;
    userId?: string;
  }) => ({
    web: [
      {
        kind: "web",
        title: "stub-result",
        url: "https://example.test",
        snippet: requirement,
        score: 0.75,
      },
    ],
  }),
  buildContextBundle: async ({
    receipts,
  }: {
    receipts: Record<string, unknown>;
  }) => ({
    maxTokens: 2000,
    estimatedTokens: 80,
    files: [
      {
        path: "README.md",
        startLine: 1,
        endLine: 5,
        tokens: 20,
        content: "# Stub context",
      },
    ],
    receipts,
  }),
}));

mock.module("@alfred/rag", () => ({
  embed: async (_text: string) => [0.1, 0.2, 0.3],
  embedMany: async (_inputs: string[]) => [
    [0.1, 0.2, 0.3],
    [0.2, 0.1, 0.4],
  ],
  rerank: async ({ documents }: { documents: { id?: string }[] }) =>
    documents.map((doc, idx) => ({
      id: doc.id ?? `doc-${idx}`,
      score: 0.5,
    })),
  chunk: vi.fn(),
  ingest: vi.fn(),
  retrieve: vi.fn().mockResolvedValue([]),
  setEmbeddingProvider: vi.fn(),
}));

mock.module("@alfred/db/repo/rag", () => ({
  searchChunksHybrid: async () => [],
  searchChunks: async () => [],
}));

mock.module("@alfred/agent/assistant/graphstore", () => ({
  persistExecPlans: vi.fn().mockImplementation(async () => {}),
  persistKnowledge: vi.fn().mockImplementation(async () => {}),
  linkRagProvenanceToReasoning: vi.fn().mockImplementation(async () => {}),
}));

mock.module("@alfred/agent/workflow/review-gate", () => {
  class ReviewGateStub {
    requireAtLeast() {}
    applyPlan() {}
    recordCheck() {}
    isSatisfied() {
      return !fixtureState.reviewGateShouldFail;
    }
    summary() {
      return [];
    }
  }
  return { ReviewGate: ReviewGateStub };
});

export function setReviewGateFailureMode(shouldFail: boolean) {
  fixtureState.reviewGateShouldFail = shouldFail;
}

mock.module("@alfred/runtime/orchestrator/review", () => ({
  async *runReviewPhase() {
    yield {
      type: "notice",
      message: "review_phase_skipped",
    } as any;
  },
}));

const runtimeReviewPath = path.resolve(
  process.cwd(),
  "packages/runtime/src/orchestrator/review.ts"
);
mock.module(runtimeReviewPath, () => ({
  async *runReviewPhase() {
    yield {
      type: "notice",
      message: "review_phase_skipped",
    } as any;
  },
}));

export interface WorkflowRuntimeFixtureOptions {
  vcr?: VCRConfig;
}

export async function installWorkflowRuntimeFixture(
  options?: WorkflowRuntimeFixtureOptions
): Promise<WorkflowRuntimeFixtureHandle> {
  // Initialize VCR if configured
  if (options?.vcr) {
    fixtureState.activeVcr = createVCR({
      cassettePath: options.vcr.cassettePath,
      strictReplay: options.vcr.strictReplay ?? false,
    });
    await fixtureState.activeVcr.start();
    // When VCR is active, it intercepts fetch requests
    // AI providers using fetch will be automatically recorded/replayed
  }
  const runs = new Map<string, WorkflowRunRecord>();
  const events: WorkflowEventRecord[] = [];
  const linearRequests: LinearRequest[] = [];

  const repoImpl = {
    createRun: vi.fn(async (args: any) => {
      const id = args.id ?? randomUUID();
      const record: WorkflowRunRecord = {
        id,
        userId: args.userId,
        workflowId: args.workflowId,
        status: args.status ?? "running",
        inputData: args.inputData,
        stateData: args.stateData,
        linearSessionId: args.linearSessionId ?? null,
        linearSpace: args.linearSpace ?? null,
        linearIssueId: args.linearIssueId ?? null,
        linearIssueUrl: args.linearIssueUrl ?? null,
      };
      runs.set(id, record);
      return record;
    }),
    updateRun: vi.fn(async (runId: string, patch: Record<string, unknown>) => {
      const current = runs.get(runId);
      if (!current) {
        return;
      }
      const updated: WorkflowRunRecord = {
        ...current,
        ...(patch.status ? { status: patch.status as string } : {}),
        ...(Object.hasOwn(patch, "stateData")
          ? { stateData: patch.stateData }
          : {}),
        ...(Object.hasOwn(patch, "errorMessage")
          ? { errorMessage: (patch.errorMessage ?? null) as string | null }
          : {}),
        ...(Object.hasOwn(patch, "linearSessionId")
          ? {
              linearSessionId: (patch.linearSessionId ?? null) as string | null,
            }
          : {}),
        ...(Object.hasOwn(patch, "linearSpace")
          ? { linearSpace: (patch.linearSpace ?? null) as string | null }
          : {}),
        ...(Object.hasOwn(patch, "linearIssueId")
          ? { linearIssueId: (patch.linearIssueId ?? null) as string | null }
          : {}),
        ...(Object.hasOwn(patch, "linearIssueUrl")
          ? { linearIssueUrl: (patch.linearIssueUrl ?? null) as string | null }
          : {}),
      };
      runs.set(runId, updated);
      return updated;
    }),
    appendEvent: vi.fn(async (args: any) => {
      const eventId = args.eventId ?? randomUUID();
      const row: WorkflowEventRecord = {
        runId: args.runId,
        eventId,
        eventType: args.eventType,
        eventData: args.eventData,
        stepId: args.stepId ?? null,
        timestamp: args.timestamp ?? new Date(),
      };
      events.push(row);
      return row;
    }),
    getRun: vi.fn(async (runId: string) => runs.get(runId)),
    listEvents: vi.fn(async (runId: string) =>
      sortByTimestampDesc(events.filter((evt) => evt.runId === runId))
    ),
    listEventsByType: vi.fn(async (runId: string, eventType: string) =>
      sortByTimestampAsc(
        events.filter(
          (evt) => evt.runId === runId && evt.eventType === eventType
        )
      )
    ),
    listEventsByTypePaged: vi.fn(
      async (args: {
        runId: string;
        eventType: string;
        page?: number;
        pageSize?: number;
        order?: "asc" | "desc";
      }) => {
        const page = Math.max(0, args.page ?? 0);
        const pageSize = Math.min(Math.max(1, args.pageSize ?? 500), 2000);
        const filtered = events.filter(
          (evt) => evt.runId === args.runId && evt.eventType === args.eventType
        );
        const ordered =
          args.order === "desc"
            ? sortByTimestampDesc(filtered)
            : sortByTimestampAsc(filtered);
        return ordered.slice(page * pageSize, page * pageSize + pageSize);
      }
    ),
    countEventsByType: vi.fn(
      async (runId: string, eventType: string) =>
        events.filter(
          (evt) => evt.runId === runId && evt.eventType === eventType
        ).length
    ),
  };

  mock.module("@alfred/db/repo/workflow", () => repoImpl);
  mock.module("@alfred/db/src/repo/workflow", () => repoImpl);

  const linearRepoStub = {
    getLinearByWorkspace: vi.fn(async () => ({
      token: "linear-token",
      appUser: "delegate-test",
    })),
  };

  mock.module("@alfred/db/repo/linear", () => linearRepoStub);
  mock.module("@alfred/db/src/repo/linear", () => linearRepoStub);

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      if (req.method !== "POST") {
        return new Response("not found", { status: 404 });
      }
      const payload = (await req.json()) as Record<string, unknown>;
      const actionValue = payload.action;
      linearRequests.push({
        action: typeof actionValue === "string" ? actionValue : undefined,
        input: payload,
      });
      const action = String(actionValue ?? "activity");
      const id = (payload.issueId ??
        payload.sessionId ??
        payload.teamId ??
        randomUUID()) as string;
      const body: Record<string, unknown> = {
        ok: true,
        id,
        url: `https://linear.local/${id}`,
      };
      if (action === "set-started") {
        body.stateId = "state_started";
      } else if (action === "set-completed") {
        body.stateId = "state_completed";
      } else if (action === "set-cancelled") {
        body.stateId = "state_cancelled";
      }
      return Response.json(body);
    },
  });

  const linearStubUrl = `http://127.0.0.1:${server.port}`;

  mock.module("@alfred/agent/orchestrator/tool/ticket", () => {
    const schema = z.any();
    async function forward(input: Record<string, unknown>) {
      const res = await fetch(`${linearStubUrl}/linear`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return (await res.json()) as Record<string, unknown>;
    }
    const toolTicket = {
      name: "ticket",
      description: "Linear ticket stub",
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ input }: { input: Record<string, unknown> }) =>
        forward(input),
    };
    return {
      toolTicket,
      aiToolTicket: {
        name: "ticket",
        description: "Linear ticket stub",
        parameters: schema,
        inputSchema: schema,
        execute: async (input: Record<string, unknown>) => forward(input),
      },
    };
  });

  return {
    repo: repoImpl,
    runs,
    events,
    linearRequests,
    linearStubUrl,
    setAiStreamMode(mode: StreamMode) {
      aiStreamState.mode = mode;
    },
    setReviewGateFailure(mode: boolean) {
      setReviewGateFailureMode(mode);
    },
    clearRepo() {
      runs.clear();
      events.splice(0);
    },
    clearLinearRequests() {
      linearRequests.splice(0);
    },
    async stop() {
      server.stop();
      if (fixtureState.activeVcr) {
        await fixtureState.activeVcr.stop();
        fixtureState.activeVcr = null;
      }
    },
    /** VCR instance when VCR mode is enabled */
    vcr: fixtureState.activeVcr,
  };
}

export async function withWorkflowRuntime(
  fn: (handle: WorkflowRuntimeFixtureHandle) => Promise<void>
): Promise<void> {
  const handle = await installWorkflowRuntimeFixture();
  try {
    await fn(handle);
  } finally {
    await handle.stop();
  }
}

// Auto-register reset function with preload
registerMockReset(resetWorkflowFixtureState);
