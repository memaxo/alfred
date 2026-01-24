import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { type PipelineEvent } from "@alfred/pipeline";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { CompilationObserver } from "../../services/compilation";
import { ConciergeObserver } from "../../services/concierge";
import { authedProcedure, rateLimit } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { enforceWorkflowPlanPolicy } from "../../workflow/access";
import { WorkflowCheckpointStorage } from "../../workflow/checkpoint";
import { linearInputSchema, workflowInputSchema } from "../../workflow/input";

export const workflowStreamPipelineProcedure = authedProcedure
  .use(rateLimit)
  .input(workflowInputSchema)
  .subscription(({ input, ctx }) =>
    observable<PipelineEvent>((emit) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        emit.error(
          new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
        );
        return () => {};
      }

      let cleanup: (() => void) | undefined;

      const startPipeline = async () => {
        const abortController = new AbortController();
        const runId = input.runId ?? crypto.randomUUID();

        try {
          const normalizedMode =
            input.mode === "parallel" || input.mode === "sequential"
              ? input.mode
              : "sequential";
          const { workflowInput } =
            await import("@alfred/agent/workflow/schema");
          const policyInput = workflowInput.parse({
            ...input,
            auto: input.auto ?? "low",
            mode: normalizedMode,
          });

          const { obligations } = await enforceWorkflowPlanPolicy({
            input: policyInput,
            session,
          });

          if (obligations.length > 0) {
            emit.next({
              reason: "policy_obligation",
              timestamp: Date.now(),
              type: "pipeline:suspend",
            });
            emit.complete();
            return;
          }

          const [
            { PipelineRunner, registerDefaultStages },
            {
              CheckpointObserver,
              CostCleanupObserver,
              MetricsObserver,
              PipelineEventQueueObserver,
              LinearSyncObserver,
            },
            { registerRunHandle, unregisterRunHandle },
            { ensureLinearTicket },
            { bootstrapLinearSession },
            { PostgresCheckpointStorage },
          ] = await Promise.all([
            import("@alfred/pipeline"),
            import("@alfred/pipeline/observers"),
            import("@alfred/agent/workflow/session-recovery"),
            import("@alfred/agent/workflow/linear"),
            import("@alfred/runtime/workflow/linear"),
            import("@alfred/db/repo/workflow"),
          ]);

          const rawInput = input as Record<string, unknown>;
          const parsedLinear = linearInputSchema.safeParse(input.linear);
          let normalizedLinear = parsedLinear.success
            ? parsedLinear.data
            : undefined;

          if (normalizedLinear && input.authzLinear) {
            try {
              const ensured = await ensureLinearTicket({
                authzLinear: input.authzLinear,
                linear: normalizedLinear,
                requirement: input.requirement,
              });
              normalizedLinear = ensured.linear;
            } catch (error) {
              logger.warn("pipeline_stream_linear_ticket_failed", {
                error: error instanceof Error ? error.message : String(error),
                runId,
              });
            }
          }

          if (normalizedLinear && input.authzLinear) {
            await bootstrapLinearSession({
              authz: input.authzLinear,
              linear: normalizedLinear,
              requirement: input.requirement,
              runId,
            });
          }

          const { toolgraph } = rawInput;
          const maxParallel =
            typeof toolgraph === "object" &&
            toolgraph !== null &&
            typeof (toolgraph as { maxParallel?: unknown }).maxParallel ===
              "number"
              ? (toolgraph as { maxParallel: number }).maxParallel
              : 4;

          const runner = new PipelineRunner({
            enableLearning: true,
            enableLinearSync: Boolean(normalizedLinear?.sessionId),
            linearSyncInterval: 30_000,
            maxParallel: input.mode === "parallel" ? maxParallel : 1,
          });
          registerDefaultStages(runner);

          const queueObserver = new PipelineEventQueueObserver();
          runner.addObserver(queueObserver);
          runner.addObserver(new MetricsObserver());
          runner.addObserver(new CostCleanupObserver());
          runner.addObserver(
            new CheckpointObserver(
              new WorkflowCheckpointStorage(new PostgresCheckpointStorage())
            )
          );
          runner.addObserver(
            new CompilationObserver({
              requirement: input.requirement,
              runId,
            })
          );
          runner.addObserver(
            new ConciergeObserver({
              runId,
              userId: session.user.id,
            })
          );

          if (normalizedLinear?.sessionId && input.authzLinear) {
            runner.addObserver(
              new LinearSyncObserver({
                authz: input.authzLinear,
                issueId: normalizedLinear.issueId ?? normalizedLinear.sessionId,
                space: normalizedLinear.space,
                syncIntervalMs: 30_000,
              })
            );
          }

          await registerRunHandle(runId, {
            abortController,
            cancel: () => {
              abortController.abort();
              return Promise.resolve();
            },
            resume: () => Promise.resolve(),
            suspend: () => {
              abortController.abort();
              return Promise.resolve();
            },
          });

          cleanup = () => {
            abortController.abort();
            queueObserver.close();
            void unregisterRunHandle(runId).catch(() => {});
          };

          const workspace =
            typeof rawInput.workspace === "string" &&
            rawInput.workspace.length > 0
              ? rawInput.workspace
              : typeof rawInput.cw === "string" && rawInput.cw.length > 0
                ? rawInput.cw
                : process.cwd();

          // Ensure run exists before persisting checkpoints/compilation (FK).
          const existingRun = await workflowRepo.getRun(runId);
          if (!existingRun) {
            await workflowRepo.createRun({
              id: runId,
              inputData: {
                requirement: input.requirement,
                workspace,
                runId,
              },
              linearIssueId: normalizedLinear?.issueId,
              linearSessionId: normalizedLinear?.sessionId,
              linearSpace: normalizedLinear?.space,
              requirement: input.requirement,
              status: "running",
              userId: session.user.id,
              workflowId: "pipeline",
            });
          }

          const pipelineInput = {
            authz:
              typeof rawInput.authz === "string" ? rawInput.authz : undefined,
            linear: normalizedLinear
              ? {
                  sessionId: normalizedLinear.sessionId ?? "",
                  space: normalizedLinear.space,
                  teamId: normalizedLinear.teamId,
                  issueId: normalizedLinear.issueId,
                  authz: input.authzLinear ?? "",
                }
              : undefined,
            requirement: input.requirement,
            runId,
            userId: session.user.id,
            workspace,
          };

          const { wrapEventEnvelope } =
            await import("@alfred/agent/utils/envelope");

          const persistTasks = new Set<Promise<void>>();
          const persistPipelineEvent = (event: PipelineEvent): void => {
            // Skip high-volume chatter
            if (
              event.type === "stage:progress" ||
              event.type === "agent:progress"
            ) {
              return;
            }

            const mapped = ((): {
              eventType: import("@alfred/db/schema/workflow").WorkflowEventType;
              data: Record<string, unknown>;
            } | null => {
              switch (event.type) {
                case "pipeline:start": {
                  return {
                    eventType: "run",
                    data: {
                      kind: "pipeline_start",
                      runId: event.runId,
                      requirement: event.requirement,
                    },
                  };
                }
                case "stage:enter": {
                  return {
                    eventType: "step-start",
                    data: { kind: "stage_enter", stage: event.stage },
                  };
                }
                case "stage:exit": {
                  return {
                    eventType: "step-complete",
                    data: {
                      kind: "stage_exit",
                      stage: event.stage,
                      durationMs: event.durationMs,
                    },
                  };
                }
                case "stage:error": {
                  return {
                    eventType: "error",
                    data: {
                      kind: "stage_error",
                      stage: event.stage,
                      message: event.error,
                    },
                  };
                }
                case "agent:spawn": {
                  return {
                    eventType: "agent-start",
                    data: {
                      kind: "agent_spawn",
                      agentId: event.agentId,
                      taskId: event.taskId,
                    },
                  };
                }
                case "agent:complete": {
                  return {
                    eventType: "agent-complete",
                    data: {
                      kind: "agent_complete",
                      agentId: event.agentId,
                      outcome: event.outcome,
                    },
                  };
                }
                case "agent:escalate-request": {
                  return {
                    eventType: "notice",
                    data: {
                      kind: "escalation",
                      agentId: event.agentId,
                      reason: event.reason,
                      details: event.details,
                      suggestions: event.suggestions,
                      severity: event.severity,
                      timestamp: event.timestamp,
                    },
                  };
                }
                case "pipeline:suspend": {
                  return {
                    eventType: "suspend",
                    data: { kind: "pipeline_suspend", reason: event.reason },
                  };
                }
                case "pipeline:resume": {
                  return {
                    eventType: "resume",
                    data: {
                      kind: "pipeline_resume",
                      fromStage: event.fromStage,
                    },
                  };
                }
                case "pipeline:complete": {
                  return {
                    eventType: "finish",
                    data: {
                      kind: "pipeline_complete",
                      summary: event.summary,
                      summaryText: event.summaryText,
                    },
                  };
                }
                case "pipeline:failed": {
                  return {
                    eventType: "error",
                    data: {
                      kind: "pipeline_failed",
                      lastStage: event.lastStage,
                      message: event.error,
                    },
                  };
                }
              }
              return null;
            })();

            if (!mapped) {
              return;
            }

            const p = workflowRepo
              .appendEvent({
                eventData: wrapEventEnvelope({
                  id: crypto.randomUUID(),
                  type: mapped.eventType,
                  resource: "user",
                  data: mapped.data,
                }),
                eventType: mapped.eventType,
                runId,
                timestamp: new Date(event.timestamp),
              })
              .then(() => {})
              .catch((error) => {
                logger.warn("workflow_pipeline_event_persist_failed", {
                  error: error instanceof Error ? error.message : String(error),
                  eventType: event.type,
                  runId,
                });
              })
              .finally(() => {
                persistTasks.delete(p);
              });

            persistTasks.add(p);
          };

          void (async () => {
            try {
              for await (const _event of runner.run(
                pipelineInput,
                abortController.signal
              )) {
                void _event;
              }
            } catch (error) {
              logger.warn("pipeline_stream_failed", {
                error: error instanceof Error ? error.message : String(error),
                runId,
              });
            } finally {
              queueObserver.close();
              await unregisterRunHandle(runId).catch(() => {});
            }
          })();

          for await (const event of queueObserver.stream()) {
            persistPipelineEvent(event);
            emit.next(event);
          }
          await Promise.allSettled([...persistTasks]);
          emit.complete();
        } catch (error) {
          emit.error(toTRPCError(error, "workflow_pipeline_stream_error"));
        }
      };

      void startPipeline();

      return () => {
        cleanup?.();
      };
    })
  );
