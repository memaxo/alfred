import type { PipelineEvent } from "@alfred/pipeline";

import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

import { CompilationObserver } from "../../services/compilation";
import { ConciergeObserver } from "../../services/concierge";
import { upsertWorkflowPatternFromCompletion } from "../../services/pattern";
import { authedProcedure } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../workflow/checkpoint";
import { attachHooksObserver } from "../../workflow/hooks";
import { createPipelineEventPersister } from "../../workflow/persist";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

export const workflowResumePipelineProcedure = authedProcedure
  .input(
    z.object({
      dryRun: z.boolean().optional(),
      runId: z.string().min(1),
    })
  )
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

      const startResume = async () => {
        try {
          const [
            { PipelineRunner, registerDefaultStages },
            {
              CheckpointObserver,
              CostCleanupObserver,
              MetricsObserver,
              PipelineEventQueueObserver,
              LinearSyncObserver,
            },
            { PostgresCheckpointStorage },
            { registerRunHandle, unregisterRunHandle },
          ] = await Promise.all([
            import("@alfred/pipeline"),
            import("@alfred/pipeline/observers"),
            import("@alfred/db/repo/workflow"),
            import("@alfred/agent/workflow/session-recovery"),
          ]);

          const storage = new WorkflowCheckpointStorage(
            isTestMode
              ? getTestCheckpointStorage()
              : new PostgresCheckpointStorage()
          );
          const snapshot = await storage.load(input.runId);
          if (!snapshot) {
            emit.error(
              new TRPCError({
                code: "NOT_FOUND",
                message: "no_checkpoint_found",
              })
            );
            return;
          }

          if (input.dryRun) {
            try {
              const updatedSnapshot = { ...snapshot };
              const contextMap = new Map(updatedSnapshot.contextEntries);
              contextMap.set("dryRun", true);
              updatedSnapshot.contextEntries = [...contextMap.entries()];
              await storage.save(input.runId, updatedSnapshot);
            } catch {
              // Best-effort.
            }
          }

          const resumeSnapshot = await storage.load(input.runId);
          if (!resumeSnapshot) {
            emit.error(
              new TRPCError({
                code: "NOT_FOUND",
                message: "no_checkpoint_found",
              })
            );
            return;
          }

          const ctxEntries = new Map(resumeSnapshot.contextEntries ?? []);
          const workspace =
            (ctxEntries.get("workspace") as string | undefined) ??
            process.cwd();
          const userId =
            (ctxEntries.get("userId") as string | undefined) ?? session.user.id;
          const linearSessionId = ctxEntries.get("linearSessionId");
          const linearIssueId = ctxEntries.get("linearIssueId");
          const linearSpace = ctxEntries.get("linearSpace");
          const linearTeamId = ctxEntries.get("linearTeamId");
          const linearAuthz = ctxEntries.get("linearAuthz");

          const abortController = new AbortController();

          const runner = new PipelineRunner({
            enableLearning: true,
            enableLinearSync: Boolean(linearSessionId),
            linearSyncInterval: 30_000,
          });
          registerDefaultStages(runner);

          await attachHooksObserver(runner, {
            runId: input.runId,
            sessionId: session.session.id,
            signal: abortController.signal,
            workspace,
          });

          const queueObserver = new PipelineEventQueueObserver();
          runner.addObserver(queueObserver);
          runner.addObserver(new MetricsObserver());
          runner.addObserver(new CostCleanupObserver());
          runner.addObserver(new CheckpointObserver(storage));
          runner.addObserver(
            new CompilationObserver({
              requirement: resumeSnapshot.requirement,
              runId: input.runId,
            })
          );
          runner.addObserver(
            new ConciergeObserver({
              runId: input.runId,
              userId,
            })
          );

          // Best-effort: mark run as running when resuming.
          try {
            const { workflowRepo } = await import("@alfred/db");
            await workflowRepo.updateRun(input.runId, {
              errorMessage: null,
              resumedAt: new Date(),
              status: "running",
              suspendedAt: null,
            });
          } catch {
            // Ignore; streaming resume should still proceed.
          }

          if (
            typeof linearSessionId === "string" &&
            typeof linearIssueId === "string" &&
            typeof linearSpace === "string" &&
            typeof linearAuthz === "string" &&
            linearAuthz.length > 0
          ) {
            runner.addObserver(
              new LinearSyncObserver({
                authz: linearAuthz,
                issueId: linearIssueId,
                space: linearSpace,
                syncIntervalMs: 30_000,
              })
            );
          }

          await registerRunHandle(input.runId, {
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
            void unregisterRunHandle(input.runId).catch(() => {});
          };

          const pipelineInput = {
            authz: undefined,
            linear:
              typeof linearSessionId === "string" &&
              typeof linearSpace === "string" &&
              typeof linearAuthz === "string" &&
              linearAuthz.length > 0
                ? {
                    sessionId: linearSessionId,
                    space: linearSpace,
                    teamId:
                      typeof linearTeamId === "string"
                        ? linearTeamId
                        : undefined,
                    issueId:
                      typeof linearIssueId === "string"
                        ? linearIssueId
                        : undefined,
                    authz: linearAuthz,
                  }
                : undefined,
            requirement: resumeSnapshot.requirement,
            runId: input.runId,
            userId,
            workspace,
          };

          void (async () => {
            try {
              for await (const _event of runner.resume(
                resumeSnapshot,
                pipelineInput,
                abortController.signal
              )) {
                void _event;
              }

              try {
                const finalSnapshot = await storage.load(input.runId);
                const finalStatus = finalSnapshot?.status ?? "failed";

                if (finalSnapshot && finalStatus === "completed") {
                  try {
                    const { createContextFromSnapshot } =
                      await import("@alfred/pipeline/snapshot");
                    const ctxDecoded = createContextFromSnapshot(
                      finalSnapshot,
                      {
                        emit: () => {},
                      }
                    );
                    const planOutput = ctxDecoded.get("planOutput") as
                      | { structuredPlan?: unknown }
                      | undefined;
                    const initOutput = ctxDecoded.get("initOutput") as
                      | { projectId?: string }
                      | undefined;
                    const plan = planOutput?.structuredPlan;

                    const isRecord = (
                      value: unknown
                    ): value is Record<string, unknown> =>
                      typeof value === "object" &&
                      value !== null &&
                      !Array.isArray(value);

                    if (isRecord(plan)) {
                      const { phases } = plan;
                      const { resources } = plan;
                      const { evaluationCriteria } = plan;
                      const intent =
                        typeof plan.intent === "string" &&
                        plan.intent.length > 0
                          ? plan.intent
                          : finalSnapshot.requirement;

                      if (phases && resources && evaluationCriteria) {
                        await upsertWorkflowPatternFromCompletion({
                          durationMs: Math.max(
                            0,
                            finalSnapshot.lastEventAt - finalSnapshot.startedAt
                          ),
                          intent,
                          planTemplate: {
                            phases,
                            resources,
                            evaluationCriteria,
                          },
                          projectId: initOutput?.projectId ?? null,
                          userId,
                        });
                      }
                    }
                  } catch {
                    // Best-effort.
                  }
                }

                const { workflowRepo } = await import("@alfred/db");
                await workflowRepo.updateRun(input.runId, {
                  completedAt:
                    finalStatus === "completed" || finalStatus === "failed"
                      ? new Date()
                      : null,
                  errorMessage:
                    finalStatus === "failed"
                      ? (finalSnapshot?.error ?? "pipeline_failed")
                      : null,
                  status:
                    finalStatus === "completed"
                      ? "completed"
                      : finalStatus === "suspended"
                        ? "suspended"
                        : "failed",
                  suspendedAt: finalStatus === "suspended" ? new Date() : null,
                });
              } catch {
                // Best-effort.
              }
            } catch (error) {
              logger.warn("pipeline_resume_failed", {
                error: error instanceof Error ? error.message : String(error),
                runId: input.runId,
              });
              try {
                const { workflowRepo } = await import("@alfred/db");
                await workflowRepo.updateRun(input.runId, {
                  completedAt: new Date(),
                  errorMessage:
                    error instanceof Error ? error.message : String(error),
                  status: "failed",
                });
              } catch {
                // Best-effort.
              }
            } finally {
              queueObserver.close();
              await unregisterRunHandle(input.runId).catch(() => {});
            }
          })();

          const { wrapEventEnvelope } =
            await import("@alfred/agent/utils/envelope");
          const persister = createPipelineEventPersister({
            runId: input.runId,
            workflowRepo,
            wrapEventEnvelope,
          });

          for await (const event of queueObserver.stream()) {
            persister.persist(event);
            emit.next(event);
          }
          await persister.flush();
          emit.complete();
        } catch (error) {
          emit.error(toTRPCError(error, "workflow_resume_failed"));
        }
      };

      void startResume();

      return () => {
        cleanup?.();
      };
    })
  );
