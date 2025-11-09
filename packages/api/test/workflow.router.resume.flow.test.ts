import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import "./utils/mock-metrics";
import { createTestCaller } from "./utils/trpc";
import { toObservable } from "./utils/stream";
// Mock graph dependency pulled transitively during router import
mock.module("@alfred/db/src/repo/graph", () => ({
  getGraphClient: vi.fn().mockReturnValue({}),
  upsertNodes: vi.fn().mockResolvedValue(new Map()),
  upsertEdges: vi.fn().mockResolvedValue(undefined),
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
// Mock metrics consumed by routers to avoid importing full metrics registry
mock.module("@alfred/api/metrics", () => ({
  trpcRequestsTotal: { inc: vi.fn() },
  trpcRequestErrorsTotal: { inc: vi.fn() },
  trpcRequestDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
  workflowStreamDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
  workflowStreamEventsTotal: { inc: vi.fn() },
}));
// Also mock relative path variant used by some modules
mock.module("@alfred/api/src/metrics", () => ({
  trpcRequestsTotal: { inc: vi.fn() },
  trpcRequestErrorsTotal: { inc: vi.fn() },
  trpcRequestDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
  workflowStreamDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
  workflowStreamEventsTotal: { inc: vi.fn() },
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
}));

// Keep metrics light in tests
mock.module("@alfred/api/metrics", () => ({
  workflowStreamDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
  workflowStreamEventsTotal: { inc: vi.fn() },
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({ roles: ["user"], scopes: ["workflow.plan", "workflow.stream", "workflow.resume"] });
});

afterEach(() => {
  createRunMock.mockClear();
  appendEventMock.mockClear();
  updateRunMock.mockClear();
});

async function subscribeToStream(input: Parameters<(typeof caller)["workflow"]["stream"]>[0]) {
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

describe.skip("workflow router resume flow (integration)", () => {
  it("acknowledges deploy-authz via resume and completes", async () => {
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    // Prepare runner
    let resumed = false;
    runPlanV6Mock.mockReturnValue({
      runId: "resume-run-1",
      summary: "ok",
      resume: async () => { resumed = true; },
      cancel: () => {},
      stream: (async function* () {
        yield { type: "run", id: "resume-run-1" } as any;
        yield { type: "require-scope", scopes: ["repo.write"], event: "deploy-authz" } as any;
        // Wait a tick for resume
        await new Promise((r) => setTimeout(r, 0));
        if (resumed) {
          yield { type: "notice", message: "Authorization 'deploy-authz' acknowledged." } as any;
          yield { type: "progress", pct: 100, message: "done" } as any;
        }
      })(),
    });
    const input = { requirement: "test", auto: "medium" as const };

    // Start a stream and collect events in the background
    const events: WorkflowEvent[] = [];
  const sub: any = toObservable(caller.workflow.stream(input as any));

    const runIdRef: { id: string | null } = { id: null };

    const done = new Promise<void>((resolve, reject) => {
      sub.subscribe({
        next: (ev: WorkflowEvent) => {
          events.push(ev);
          if ((ev as any).type === "run") {
            runIdRef.id = (ev as any).id;
          }
          // When we see the require-scope, immediately post resume
          if ((ev as any).type === "require-scope" && runIdRef.id) {
            caller.workflow
              .resume({ runId: runIdRef.id, event: "deploy-authz", authz: "Bearer test" })
              .catch(reject);
          }
        },
        error: reject,
        complete: resolve,
      });
    });

    await done;

    const hasAck = events.some(
      (e: any) => e?.type === "notice" && /Authorization 'deploy-authz' acknowledged/i.test(e?.message ?? "")
    );
    const completed = events.some((e: any) => e?.type === "progress" && e?.pct === 100);

    expect(runIdRef.id).not.toBeNull();
    expect(hasAck).toBe(true);
    expect(completed).toBe(true);
  });

  it("acknowledges linear-authz via resume and completes", async () => {
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    const input = { requirement: "test", auto: "high" as const };
    let resumed = false;
    runPlanV6Mock.mockReturnValue({
      runId: "resume-run-2",
      summary: "ok",
      resume: async () => { resumed = true; },
      cancel: () => {},
      stream: (async function* () {
        yield { type: "run", id: "resume-run-2" } as any;
        yield { type: "require-scope", scopes: ["repo.write"], event: "linear-authz" } as any;
        await new Promise((r) => setTimeout(r, 0));
        if (resumed) {
          yield { type: "notice", message: "Authorization 'linear-authz' acknowledged." } as any;
          yield { type: "progress", pct: 100, message: "done" } as any;
        }
      })(),
    });

    const events: WorkflowEvent[] = [];
    const sub: any = toObservable(caller.workflow.stream(input as any));
    const runIdRef: { id: string | null } = { id: null };

    const done = new Promise<void>((resolve, reject) => {
      sub.subscribe({
        next: (ev: WorkflowEvent) => {
          events.push(ev);
          if ((ev as any).type === "run") runIdRef.id = (ev as any).id;
          if ((ev as any).type === "require-scope" && runIdRef.id) {
            caller.workflow
              .resume({ runId: runIdRef.id, event: "linear-authz", authz: "Bearer test" })
              .catch(reject);
          }
        },
        error: reject,
        complete: resolve,
      });
    });

    await done;

    const hasAck = events.some(
      (e: any) => e?.type === "notice" && /Authorization 'linear-authz' acknowledged/i.test(e?.message ?? "")
    );
    const completed = events.some((e: any) => e?.type === "progress" && e?.pct === 100);

    expect(runIdRef.id).not.toBeNull();
    expect(hasAck).toBe(true);
    expect(completed).toBe(true);
  });
});
