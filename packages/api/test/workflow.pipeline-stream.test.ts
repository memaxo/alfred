import { beforeAll, describe, expect, it, mock } from "bun:test";
import type { PipelineEvent } from "@alfred/pipeline";
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";
import { toObservable } from "./utils/stream";

setupTestEnv();
mockPolicyAudit();

mock.module("../src/workflow/access", () => ({
  enforceWorkflowPlanPolicy: async () => ({ obligations: [] }),
}));

mock.module("@alfred/agent/workflow/session-recovery", () => ({
  StreamNotAttachedError: class StreamNotAttachedError extends Error {
    name = "StreamNotAttachedError";
  },
  registerRunHandle: async () => {},
  unregisterRunHandle: async () => {},
}));

mock.module("@alfred/agent/workflow/linear", () => ({
  ensureLinearTicket: async (params: { linear?: unknown }) => ({
    linear: params.linear,
    ticket: undefined,
  }),
}));

mock.module("@alfred/runtime/workflow/linear", () => ({
  bootstrapLinearSession: async () => {},
}));

mock.module("@alfred/db/repo/workflow", () => ({
  PostgresCheckpointStorage: class {
    save() {}
    load() {
      return null;
    }
    delete() {}
  },
}));

mock.module("@alfred/pipeline", () => {
  class PipelineRunner {
    private readonly observers = new Set<{
      onEvent: (event: PipelineEvent) => void;
      onComplete?: () => void;
    }>();

    addObserver(observer: { onEvent: (event: PipelineEvent) => void }) {
      this.observers.add(observer);
      return this;
    }

    *run(input: { runId: string; requirement: string }) {
      const start: PipelineEvent = {
        type: "pipeline:start",
        runId: input.runId,
        requirement: input.requirement,
        timestamp: Date.now(),
      };
      const enter: PipelineEvent = {
        type: "stage:enter",
        stage: "init",
        timestamp: Date.now(),
      };
      const progress: PipelineEvent = {
        type: "stage:progress",
        stage: "init",
        message: "init",
        timestamp: Date.now(),
      };
      const exit: PipelineEvent = {
        type: "stage:exit",
        stage: "init",
        durationMs: 1,
        timestamp: Date.now(),
      };
      const complete: PipelineEvent = {
        type: "pipeline:complete",
        summary: {
          runId: input.runId,
          requirement: input.requirement,
          stages: [{ name: "init", durationMs: 1, status: "success" }],
          totalDurationMs: 1,
          agentsSpawned: 0,
          filesChanged: 0,
          learningInsights: 0,
        },
        timestamp: Date.now(),
      };

      for (const event of [start, enter, progress, exit, complete]) {
        for (const observer of this.observers) {
          observer.onEvent(event);
        }
        yield event;
      }

      for (const observer of this.observers) {
        observer.onComplete?.();
      }
    }
  }

  return {
    PipelineRunner,
    registerDefaultStages: () => {},
  };
});

mock.module("@alfred/pipeline/observers", () => {
  class PipelineEventQueueObserver {
    private readonly queue: PipelineEvent[] = [];
    private readonly waiters: Array<(event: PipelineEvent | null) => void> = [];
    private closed = false;

    onEvent(event: PipelineEvent) {
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(event);
        return;
      }
      this.queue.push(event);
    }

    close() {
      if (this.closed) {
        return;
      }
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) {
        waiter(null);
      }
    }

    async *stream(): AsyncGenerator<PipelineEvent, void, void> {
      while (true) {
        const next = this.queue.shift();
        if (next) {
          yield next;
          continue;
        }
        if (this.closed) {
          return;
        }
        const event = await new Promise<PipelineEvent | null>((resolve) => {
          this.waiters.push(resolve);
        });
        if (!event) {
          return;
        }
        yield event;
      }
    }
  }

  class NoopObserver {
    onEvent() {}
  }

  class CheckpointObserver extends NoopObserver {}
  class CostCleanupObserver extends NoopObserver {}
  class LinearSyncObserver extends NoopObserver {}
  class MetricsObserver extends NoopObserver {}

  return {
    CheckpointObserver,
    CostCleanupObserver,
    LinearSyncObserver,
    MetricsObserver,
    PipelineEventQueueObserver,
  };
});

const { createTestCaller } = await import("./utils/trpc");

describe("workflow pipeline stream", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller({
      scopes: ["workflow.plan", "workflow.stream", "workflow.resume"],
    });
  });

  it("streams PipelineEvent values in order", async () => {
    const observable = toObservable<PipelineEvent>(
      await caller.workflow.streamPipeline({
        requirement: "test pipeline stream",
      })
    );

    const events: PipelineEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        next: (event) => events.push(event),
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.type).toBe("pipeline:start");
    expect(events.some((event) => event.type === "stage:progress")).toBe(true);
    expect(events.at(-1)?.type).toBe("pipeline:complete");
  });
});
