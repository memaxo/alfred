process.env.USE_WORKFLOW_RUNTIME = "0";

// Import Redis mocks BEFORE any other imports
import "@alfred/test-kit/redis";

import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";

// Ensure metrics are mocked for both package and source paths BEFORE any dynamic imports
import "./utils/mock-metrics";
import "./utils/mock-voice";
import "./utils/mock-db-client";
import { metricsStub } from "./utils/mock-metrics";

// Also provide direct mocks here to be extra safe for source-path imports
// Also mock the absolute source path resolution used by relative imports
const metricsAbs = new URL("../../src/metrics.ts", import.meta.url).pathname;
mock.module(metricsAbs, () => ({
  ...metricsStub,
}));
mock.module("@alfred/api/src/metrics", () => ({
  ...metricsStub,
}));
// Also mock the runner using absolute source path because the router imports relatively
const runnerAbs = new URL("../../src/workflow/runner.ts", import.meta.url)
  .pathname;
mock.module(runnerAbs, () => ({
  runPlanV6: runPlanV6Mock,
}));
const runnerAbsJs = new URL("../../src/workflow/runner.js", import.meta.url)
  .pathname;
mock.module(runnerAbsJs, () => ({
  runPlanV6: runPlanV6Mock,
}));
// Stub TRPC wiring to avoid metrics middleware importing metrics again via package path
mock.module("@alfred/api/src/trpc", () => {
  const { initTRPC, TRPCError } = require("@trpc/server");
  const t = initTRPC.context<any>().create();
  const router = t.router;
  const base = t.procedure;
  const publicProcedure = base;
  const protectedProcedure = base.use((opts: any) => {
    if (!opts.ctx?.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    return opts.next({ ctx: { ...opts.ctx, session: opts.ctx.session } });
  });
  const authedProcedure = protectedProcedure;
  const rateLimit = t.middleware(async ({ next }) => next());
  return {
    t,
    router,
    publicProcedure,
    protectedProcedure,
    authedProcedure,
    rateLimit,
  };
});
// Import test helpers dynamically after mocks are registered
let createTestCaller: typeof import("./utils/trpc")["createTestCaller"];
let toObservable: typeof import("./utils/stream")["toObservable"];

// Mock graph dependency pulled transitively during router import.
// We provide a broad surface area because appRouter imports agent workers/tools
// that import many named exports from this module.
const graphIndexStub = {
  getGraphClient: vi.fn().mockReturnValue({}),
  findNearestConcept: vi.fn().mockResolvedValue(null),
  getReasoningChain: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  ensureMirrorNodes: vi.fn().mockResolvedValue(new Map()),
  upsertNodes: vi.fn().mockResolvedValue(new Map()),
  upsertEdges: vi.fn().mockResolvedValue([]),
  touchNodes: vi.fn().mockResolvedValue(0),
  archiveNodes: vi.fn().mockResolvedValue(0),
  deleteArchivedNodes: vi.fn().mockResolvedValue(0),
  findNodesByConfidence: vi.fn().mockResolvedValue([]),
  findStaleNodes: vi.fn().mockResolvedValue([]),
  findNodesForDecay: vi.fn().mockResolvedValue([]),
  updateNodeConfidenceBatch: vi.fn().mockResolvedValue(0),
};

mock.module("@alfred/db/repo/graph", () => graphIndexStub);
mock.module("@alfred/db/repo/graph/index", () => graphIndexStub);

const ensureMirrorNodesMock = vi.fn().mockResolvedValue(new Map());
const graphWriteStub = {
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  upsertNodes: vi.fn(),
  createEdge: vi.fn(),
  deleteEdge: vi.fn(),
  upsertEdges: vi.fn(),
  archiveNodes: vi.fn(),
  deleteArchivedNodes: vi.fn(),
  updateNodeConfidence: vi.fn(),
  updateNodeConfidenceBatch: vi.fn(),
  touchNodes: vi.fn(),
  deleteNodesBatch: vi.fn(),
};

mock.module("@alfred/db/repo/graph/write", () => ({
  ...graphWriteStub,
  ensureMirrorNodes: ensureMirrorNodesMock,
}));
// Mock policy evaluate to allow with no obligations
const evaluateMock = vi.fn();
mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: () => {},
}));

// Mock runner to control stream + resume behavior
const runPlanV6Mock = vi.fn();
mock.module("@alfred/api/workflow/runner", () => ({
  runPlanV6: runPlanV6Mock,
}));

// The workflow orchestrator lives in @alfred/agent and imports its own runner via a relative import.
// Mock both the package path and the absolute source path so `createWorkflowExecutor()` uses this stub.
mock.module("@alfred/agent/workflow/runner", () => ({
  runPlanV6: runPlanV6Mock,
}));
const agentRunnerAbs = new URL(
  "../../agent/src/workflow/runner.ts",
  import.meta.url
).pathname;
mock.module(agentRunnerAbs, () => ({
  runPlanV6: runPlanV6Mock,
}));
// Mock metrics consumed by routers to avoid importing full metrics registry
mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
}));
// Also mock relative path variant used by some modules
mock.module("@alfred/api/src/metrics", () => ({
  ...metricsStub,
}));

// Avoid DB by mocking workflow repo persistence
const createRunMock = vi.fn().mockResolvedValue(undefined);
const appendEventMock = vi.fn().mockResolvedValue(undefined);
const updateRunMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/db/repo/workflow", () => ({
  createRun: createRunMock,
  appendEvent: appendEventMock,
  updateRun: updateRunMock,
  getRun: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockResolvedValue([]),
  listRuns: vi.fn().mockResolvedValue([]),
  listEventsByType: vi.fn().mockResolvedValue([]),
  listEventsByTypePaged: vi.fn().mockResolvedValue([]),
  countEventsByType: vi.fn().mockResolvedValue(0),
}));

// Keep metrics light in tests
mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
}));

let caller: Awaited<
  ReturnType<typeof import("./utils/trpc")["createTestCaller"]>
>;

beforeAll(async () => {
  // Resolve dynamic imports after mocks are in place
  ({ createTestCaller } = await import("./utils/trpc"));
  ({ toObservable } = await import("./utils/stream"));
  caller = await createTestCaller({
    roles: ["user"],
    scopes: ["workflow.plan", "workflow.stream", "workflow.resume"],
  });
});

afterEach(() => {
  createRunMock.mockClear();
  appendEventMock.mockClear();
  updateRunMock.mockClear();
  ensureMirrorNodesMock.mockClear();
  graphIndexStub.getGraphClient.mockClear();
  graphIndexStub.findNearestConcept.mockClear();
  graphIndexStub.getReasoningChain.mockClear();
  graphIndexStub.ensureMirrorNodes.mockClear();
  graphIndexStub.upsertNodes.mockClear();
  graphIndexStub.upsertEdges.mockClear();
  graphIndexStub.touchNodes.mockClear();
  graphIndexStub.archiveNodes.mockClear();
  graphIndexStub.deleteArchivedNodes.mockClear();
  graphIndexStub.findNodesByConfidence.mockClear();
  graphIndexStub.findNodesForDecay.mockClear();
  graphIndexStub.updateNodeConfidenceBatch.mockClear();
});

async function _subscribeToStream(
  input: Parameters<(typeof caller)["workflow"]["stream"]>[0]
) {
  const events: WorkflowEvent[] = [];
  const sub: any = toObservable(caller.workflow.stream(input as any));
  await new Promise<void>((resolve, reject) => {
    sub.subscribe({
      next: (e: WorkflowEvent) => {
        events.push(e);
      },
      error: reject,
      complete: resolve,
    });
  });
  return events;
}

// Helper to create a deferred promise
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("workflow router resume flow (integration)", () => {
  it("acknowledges deploy-authz via resume and completes", async () => {
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    // Prepare runner with deferred resume promise
    const resumeGate = deferred<{ event: string; authz: string }>();
    runPlanV6Mock.mockReturnValue({
      runId: "resume-run-1",
      summary: "ok",
      resume: (payload: { event: string; authz: string }): void => {
        resumeGate.resolve(payload);
      },
      cancel: () => {
        resumeGate.reject(new Error("cancelled"));
      },
      stream: (async function* () {
        yield { _: "run", id: "resume-run-1" } as any;
        yield {
          _: "require-scope",
          scopes: ["repo.write"],
          event: "deploy-authz",
        } as any;
        // Wait for resume to be called
        await resumeGate.promise;
        // Emit notice + completion after resume
        yield {
          _: "notice",
          message: "Authorization 'deploy-authz' acknowledged.",
        } as any;
        yield { _: "report", summary: { status: "completed" } } as any;
      })(),
    });
    const input = { requirement: "test", auto: "medium" as const };

    // Start a stream and collect events in the background
    const events: WorkflowEvent[] = [];
    const candidate = await caller.workflow.stream(input as any);
    const sub: any = toObservable(candidate);

    const runIdRef: { id: string | null } = { id: null };

    const done = new Promise<void>((resolve, reject) => {
      sub.subscribe({
        next: (ev: WorkflowEvent) => {
          events.push(ev);
          if ((ev as any)._ === "run") {
            runIdRef.id = (ev as any).id;
          }
          // When we see the require-scope, immediately post resume
          if ((ev as any)._ === "require-scope" && runIdRef.id) {
            caller.workflow
              .resume({
                runId: runIdRef.id,
                event: "deploy-authz",
                authz: "Bearer test",
              })
              .catch(reject);
          }
        },
        error: (err: unknown) => {
          reject(err);
        },
        complete: resolve,
      });
    });

    await done;
    if (!runIdRef.id) {
      const firstRun = (events.find((e: any) => e?._ === "run") as any)?.id;
      if (firstRun) {
        runIdRef.id = firstRun;
      }
    }
    const completed = events.some(
      (e: any) => e?._ === "report" || (e?._ === "progress" && e?.pct === 100)
    );
    expect(completed).toBe(true);
    expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
    expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
      "user",
      expect.arrayContaining([
        expect.objectContaining({
          kind: "workflow_run",
        }),
      ]),
      expect.objectContaining({
        projectId: undefined,
      })
    );
  });

  it("acknowledges linear-authz via resume and completes", async () => {
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    const input = { requirement: "test", auto: "high" as const };
    // Prepare runner with deferred resume promise
    const resumeGate = deferred<{ event: string; authz: string }>();
    runPlanV6Mock.mockReturnValue({
      runId: "resume-run-2",
      summary: "ok",
      resume: (payload: { event: string; authz: string }): void => {
        resumeGate.resolve(payload);
      },
      cancel: () => {
        resumeGate.reject(new Error("cancelled"));
      },
      stream: (async function* () {
        yield { _: "run", id: "resume-run-2" } as any;
        yield {
          _: "require-scope",
          scopes: ["repo.write"],
          event: "linear-authz",
        } as any;
        // Wait for resume to be called
        await resumeGate.promise;
        yield {
          _: "notice",
          message: "Authorization 'linear-authz' acknowledged.",
        } as any;
        yield { _: "report", summary: { status: "completed" } } as any;
      })(),
    });

    const events: WorkflowEvent[] = [];
    const candidate = await caller.workflow.stream(input as any);
    const sub: any = toObservable(candidate);
    const runIdRef: { id: string | null } = { id: null };

    const done = new Promise<void>((resolve, reject) => {
      sub.subscribe({
        next: (ev: WorkflowEvent) => {
          events.push(ev);
          if ((ev as any)._ === "run") {
            runIdRef.id = (ev as any).id;
          }
          if ((ev as any)._ === "require-scope" && runIdRef.id) {
            caller.workflow
              .resume({
                runId: runIdRef.id,
                event: "linear-authz",
                authz: "Bearer test",
              })
              .catch(reject);
          }
        },
        error: (err: unknown) => {
          reject(err);
        },
        complete: resolve,
      });
    });

    await done;
    if (!runIdRef.id) {
      const firstRun = (events.find((e: any) => e?._ === "run") as any)?.id;
      if (firstRun) {
        runIdRef.id = firstRun;
      }
    }
    const completed = events.some(
      (e: any) => e?._ === "report" || (e?._ === "progress" && e?.pct === 100)
    );
    expect(completed).toBe(true);
  });
});
