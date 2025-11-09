import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import { createTestCaller } from "./utils/trpc";
import "./utils/mock-metrics";
import { toObservable } from "./utils/stream";
// Mock metrics consumed by routers to avoid importing full metrics registry
mock.module("@alfred/api/metrics", () => ({
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
    const input = { requirement: "test", auto: "high" as const };

    const events: WorkflowEvent[] = [];
    const sub: any = caller.workflow.stream(input as any);
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
