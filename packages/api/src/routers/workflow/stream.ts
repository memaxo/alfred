import type { PipelineEvent } from "@alfred/pipeline";

import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { CompilationObserver } from "../../services/compilation";
import { ConciergeObserver } from "../../services/concierge";
import { authedProcedure, rateLimit } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { enforceWorkflowPlanPolicy } from "../../workflow/access";
import { WorkflowCheckpointStorage } from "../../workflow/checkpoint";
import { createCognitiveBridge } from "../../workflow/cognitive";
import { attachHooksObserver } from "../../workflow/hooks";
import { linearInputSchema, workflowInputSchema } from "../../workflow/input";
import { createPipelineEventPersister } from "../../workflow/persist";

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
        const startedAt = Date.now();
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
            // Ensure run exists so clients can reference it (even if suspended).
            const existingRun = await workflowRepo.getRun(runId);
            if (!existingRun) {
              await workflowRepo.createRun({
                id: runId,
                inputData: {
                  requirement: input.requirement,
                  runId,
                  workspace: (input as { workspace?: string }).workspace,
                },
                linearIssueId: undefined,
                linearSessionId: undefined,
                linearSpace: undefined,
                requirement: input.requirement,
                status: "suspended",
                userId: session.user.id,
                workflowId: "pipeline",
              });

              await workflowRepo.updateRun(runId, {
                suspendedAt: new Date(),
              });
            }

            emit.next({
              requirement: input.requirement,
              runId,
              timestamp: Date.now(),
              type: "pipeline:start",
            });
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

          const workspace =
            typeof rawInput.workspace === "string" &&
            rawInput.workspace.length > 0
              ? rawInput.workspace
              : typeof rawInput.cw === "string" && rawInput.cw.length > 0
                ? rawInput.cw
                : process.cwd();

          const cognitive = createCognitiveBridge({
            requirement: input.requirement,
            runId,
            source: "pipeline",
            startedAtMs: startedAt,
            userId: session.user.id,
            workspace,
          });

          const autonomyLevel = await cognitive.ensureInput();

          const runner = new PipelineRunner({
            enableLearning: true,
            enableLinearSync: Boolean(normalizedLinear?.sessionId),
            linearSyncInterval: 30_000,
            maxParallel: input.mode === "parallel" ? maxParallel : 1,
          });
          registerDefaultStages(runner);

          await attachHooksObserver(runner, {
            runId,
            sessionId: session.session.id,
            signal: abortController.signal,
            workspace,
          });

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
            cognitive: {
              autonomyLevel: autonomyLevel ?? undefined,
              streamId: cognitive.streamId,
            },
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
          const persister = createPipelineEventPersister({
            runId,
            workflowRepo,
            wrapEventEnvelope,
          });

          void (async () => {
            try {
              let finalStatus:
                | "running"
                | "completed"
                | "failed"
                | "suspended" = "running";
              let finalError: string | null = null;

              for await (const _event of runner.run(
                pipelineInput,
                abortController.signal
              )) {
                if (_event.type === "pipeline:complete") {
                  finalStatus = "completed";
                  finalError = null;
                } else if (_event.type === "pipeline:failed") {
                  finalStatus = "failed";
                  finalError = _event.error;
                } else if (_event.type === "pipeline:suspend") {
                  finalStatus = "suspended";
                }

                if (
                  _event.type === "agent:complete" ||
                  _event.type === "agent:escalate-request" ||
                  _event.type === "pipeline:complete" ||
                  _event.type === "pipeline:failed" ||
                  _event.type === "pipeline:suspend"
                ) {
                  await cognitive.handlePipelineEvent(_event);
                }
              }

              // Best-effort: finalize DB run status.
              try {
                const existing = await workflowRepo.getRun(runId);
                if (
                  existing?.status !== "cancelled" &&
                  existing?.status !== "suspended"
                ) {
                  const now = new Date();
                  if (finalStatus === "completed") {
                    await workflowRepo.updateRun(runId, {
                      completedAt: now,
                      errorMessage: null,
                      status: "completed",
                      suspendedAt: null,
                    });
                  } else if (finalStatus === "suspended") {
                    await workflowRepo.updateRun(runId, {
                      completedAt: null,
                      errorMessage: null,
                      status: "suspended",
                      suspendedAt: now,
                    });
                  } else if (finalStatus === "failed") {
                    await workflowRepo.updateRun(runId, {
                      completedAt: now,
                      errorMessage: finalError ?? "pipeline_failed",
                      status: "failed",
                      suspendedAt: null,
                    });
                  }
                }
              } catch {
                // Best-effort.
              }
            } catch (error) {
              logger.warn("pipeline_stream_failed", {
                error: error instanceof Error ? error.message : String(error),
                runId,
              });
              try {
                const existing = await workflowRepo.getRun(runId);
                if (
                  existing?.status !== "cancelled" &&
                  existing?.status !== "suspended"
                ) {
                  await workflowRepo.updateRun(runId, {
                    completedAt: new Date(),
                    errorMessage:
                      error instanceof Error ? error.message : String(error),
                    status: "failed",
                  });
                }
              } catch {
                // Best-effort.
              }
            } finally {
              queueObserver.close();
              await persister.flush();
              await unregisterRunHandle(runId).catch(() => {});
            }
          })();

          for await (const event of queueObserver.stream()) {
            persister.persist(event);
            emit.next(event);
          }
          await persister.flush();
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
