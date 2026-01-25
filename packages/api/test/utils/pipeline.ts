import type { PipelineEvent } from "@alfred/pipeline";

import { mock, vi } from "bun:test";

interface PipelineObserver {
  onEvent: (event: PipelineEvent) => void;
  onComplete?: () => void;
}

export interface PipelineMockOptions {
  preferenceRefresh?: boolean;
  dbRepo?: boolean;
  sessionRecovery?: boolean;
  linear?: boolean;
  runtimeLinear?: boolean;
}

export function installPipelineMocks(options: PipelineMockOptions = {}): void {
  mock.module("@alfred/pipeline", () => {
    class PipelineRunner {
      private readonly observers = new Set<PipelineObserver>();

      addObserver(observer: { onEvent: (event: PipelineEvent) => void }) {
        this.observers.add(observer);
        return this;
      }

      *run(input: { runId: string; requirement: string }) {
        const now = Date.now();
        const outcome = {
          agentId: "agent-1",
          stuck: false,
          status: "completed",
          durationSeconds: 1.2,
          role: "codex",
          result: {
            summary: "Implemented changes",
            artifacts: ["docs/report.md"],
            changes: ["apps/web/src/example.tsx"],
            notes: ["All tests passing"],
            branch: "feature/agent-1",
          },
        };
        const executeOutput = {
          outcomes: {
            __type: "Map",
            entries: [["agent-1", outcome]],
          },
          fileChanges: [
            { path: "apps/web/src/example.tsx", action: "modify" },
            { path: "docs/report.md", action: "create" },
          ],
          handoffs: [],
        };
        const summarizeOutput = {
          summary: "Implemented changes and updated docs.",
          trajectory: { runId: input.runId, stages: [] },
          linearUpdated: false,
        };

        const events: PipelineEvent[] = [
          {
            type: "pipeline:start",
            runId: input.runId,
            requirement: input.requirement,
            timestamp: now,
          },
          {
            type: "stage:enter",
            stage: "init",
            timestamp: now + 1,
          },
          {
            type: "stage:progress",
            stage: "init",
            message: "init",
            timestamp: now + 2,
          },
          {
            type: "stage:exit",
            stage: "init",
            durationMs: 1,
            timestamp: now + 3,
          },
          {
            type: "context:set",
            key: "executeOutput",
            value: executeOutput as unknown as never,
            timestamp: now + 4,
          },
          {
            type: "context:set",
            key: "summarizeOutput",
            value: summarizeOutput as unknown as never,
            timestamp: now + 5,
          },
          {
            type: "agent:escalate-request",
            agentId: "agent-1",
            reason: "missing_dependency",
            details:
              "Missing dependency X; continuing in degraded mode for test coverage.",
            severity: "warning",
            suggestions: ["Install X to restore full functionality."],
            timestamp: now + 6,
          },
          {
            type: "pipeline:complete",
            timestamp: now + 7,
            summary: {
              agentsSpawned: 0,
              filesChanged: 0,
              learningInsights: 0,
              runId: input.runId,
              requirement: input.requirement,
              stages: [{ name: "init", durationMs: 1, status: "success" }],
              totalDurationMs: 1,
            },
            summaryText: "Implemented changes and updated docs.",
          },
        ];

        for (const event of events) {
          for (const observer of this.observers) {
            observer.onEvent(event);
          }
          yield event;
        }

        for (const observer of this.observers) {
          observer.onComplete?.();
        }
      }

      async *resume() {
        // no-op for tests; observers will be fed by the mocked caller
      }
    }

    return {
      PipelineRunner,
      registerDefaultStages: () => {},
      // Used by workflow.phase.updatePlan and snapshot persistence.
      toSerializable: (value: unknown) => value as unknown,
    };
  });

  mock.module("@alfred/pipeline/observers", () => {
    class PipelineEventQueueObserver {
      private readonly queue: PipelineEvent[] = [];
      private readonly waiters: ((event: PipelineEvent | null) => void)[] = [];
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

      onComplete() {
        this.close();
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
    class InMemoryCheckpointStorage {}

    return {
      CheckpointObserver,
      CostCleanupObserver,
      LinearSyncObserver,
      MetricsObserver,
      PipelineEventQueueObserver,
      InMemoryCheckpointStorage,
    };
  });

  if (options.sessionRecovery) {
    mock.module("@alfred/agent/workflow/session-recovery", () => ({
      StreamNotAttachedError: class StreamNotAttachedError extends Error {
        name = "StreamNotAttachedError";
      },
      registerRunHandle: async () => {},
      unregisterRunHandle: async () => {},
    }));
  }

  if (options.runtimeLinear) {
    mock.module("@alfred/runtime/workflow/linear", () => ({
      bootstrapLinearSession: async () => {},
    }));
  }

  if (options.linear) {
    mock.module("@alfred/agent/workflow/linear", () => ({
      ensureLinearTicket: async (params: { linear?: unknown }) => ({
        linear: params.linear,
        ticket: undefined,
      }),
    }));
  }

  if (options.dbRepo) {
    mock.module("@alfred/db/repo/workflow", () => {
      const runs = new Map<
        string,
        {
          id: string;
          userId: string;
          status: string;
          created: string;
          updated: string;
          stateData: unknown;
          inputData: unknown;
        }
      >();
      const eventsByRun = new Map<
        string,
        {
          id: string;
          eventId: string;
          runId: string;
          eventType: string;
          eventData: unknown;
          timestamp: string;
        }[]
      >();

      const now = () => new Date().toISOString();

      return {
        PostgresCheckpointStorage: class {
          save() {}
          load() {
            return null;
          }
          delete() {}
        },
        getRun: (runId: string) => Promise.resolve(runs.get(runId) ?? null),
        createRun: (args: {
          id?: string;
          userId: string;
          workflowId: string;
          status?: string;
          requirement?: string;
          inputData?: unknown;
        }) => {
          const id =
            typeof args.id === "string" && args.id.length > 0
              ? args.id
              : crypto.randomUUID();
          const created = now();
          const run = {
            id,
            userId: args.userId,
            status: args.status ?? "running",
            created,
            updated: created,
            stateData: null,
            inputData: args.inputData ?? null,
          };
          runs.set(id, run);
          return Promise.resolve(run);
        },
        updateRun: (
          runId: string,
          patch: Partial<{
            status: string;
            stateData: unknown;
            inputData: unknown;
          }>
        ) => {
          const existing =
            runs.get(runId) ??
            ({
              id: runId,
              userId: "workflow-test-user",
              status: "running",
              created: now(),
              updated: now(),
              stateData: null,
              inputData: null,
            } as const);

          const next = {
            ...existing,
            ...(patch.status ? { status: patch.status } : {}),
            ...(Object.hasOwn(patch, "stateData")
              ? { stateData: patch.stateData ?? null }
              : {}),
            ...(Object.hasOwn(patch, "inputData")
              ? { inputData: patch.inputData ?? null }
              : {}),
            updated: now(),
          };
          runs.set(runId, next);
          return Promise.resolve(next);
        },
        appendEvent: (args: {
          runId: string;
          eventType: string;
          eventData?: unknown;
        }) => {
          const id = crypto.randomUUID();
          const event = {
            id,
            eventId: crypto.randomUUID(),
            runId: args.runId,
            eventType: args.eventType,
            eventData: args.eventData ?? null,
            timestamp: now(),
          };
          const list = eventsByRun.get(args.runId) ?? [];
          list.push(event);
          eventsByRun.set(args.runId, list);
          return Promise.resolve(event);
        },
        listEvents: (runId: string) =>
          Promise.resolve(eventsByRun.get(runId) ?? []),
      };
    });
  }

  if (options.preferenceRefresh) {
    mock.module("@alfred/api/preference/refresh", () => ({
      triggerPreferenceRefresh: vi.fn(),
    }));
  }
}
