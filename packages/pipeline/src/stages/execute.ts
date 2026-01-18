import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Workspace } from "@alfred/agent/environment/types";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type {
  AgentOutcome,
  ExecuteOutput,
  FileChange,
  PlanOutput,
  ScheduleOutput,
} from "./types";

/**
 * Execute Stage
 *
 * Spawns and runs agents for each wave in the schedule.
 * Integrates:
 * - TrackerContext for stuck detection
 * - Escalation file detection
 * - Configurable retry logic
 * - Wave abort on failure thresholds
 */
export class ExecuteStage
  implements PipelineStage<ScheduleOutput, ExecuteOutput>
{
  readonly name = "execute" as const;

  private formatQueueEvent(event: WorkflowEvent): string {
    const payload = event as unknown as Record<string, unknown>;
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
    if (typeof payload.kind === "string" && payload.kind.length > 0) {
      return payload.kind;
    }
    if (typeof payload.type === "string" && payload.type.length > 0) {
      return payload.type;
    }
    return "agent_event";
  }

  async execute(
    input: ScheduleOutput,
    ctx: PipelineContext
  ): Promise<ExecuteOutput> {
    const outcomes = new Map<string, AgentOutcome>();
    const fileChanges: FileChange[] = [];
    const handoffs: string[] = [];
    const activeWorkspaces: Workspace[] = [];

    // Check for partial execution options
    const waveIds = ctx.get<string[]>("waveIds");
    const skipTaskIds = ctx.get<string[]>("skipTaskIds");
    const dryRun = ctx.get<boolean>("dryRun") ?? false;

    // Filter waves if waveIds specified
    let wavesToExecute = input.waves;
    if (waveIds && waveIds.length > 0) {
      wavesToExecute = input.waves.filter((w) => waveIds.includes(w.id));
      ctx.emit(
        createEvent("stage:progress", {
          stage: "execute",
          message: `Partial execution: ${wavesToExecute.length}/${input.waves.length} waves selected`,
        })
      );
    }

    // Filter tasks if skipTaskIds specified
    if (skipTaskIds && skipTaskIds.length > 0) {
      wavesToExecute = wavesToExecute.map((wave) => ({
        ...wave,
        agents: wave.agents.filter((id) => !skipTaskIds.includes(id)),
      }));
      ctx.emit(
        createEvent("stage:progress", {
          stage: "execute",
          message: `Skipping ${skipTaskIds.length} tasks`,
        })
      );
    }

    // Dry run mode - validate only, no agent spawning
    if (dryRun) {
      ctx.emit(
        createEvent("stage:progress", {
          stage: "execute",
          message: `[DRY RUN] Would execute ${wavesToExecute.length} waves with ${wavesToExecute.reduce((sum, w) => sum + w.agents.length, 0)} total agents`,
        })
      );

      // Return mock outcomes for dry run
      for (const wave of wavesToExecute) {
        for (const agentId of wave.agents) {
          outcomes.set(agentId, {
            agentId,
            phaseId: "execute",
            stuck: false,
            status: "success",
            durationSeconds: 0,
            role: "agent",
            result: {
              summary: "[DRY RUN] Agent not spawned",
              artifacts: [],
              changes: [],
              notes: ["Dry run - no actual execution"],
            },
          });
        }
      }

      return {
        outcomes,
        fileChanges: [],
        handoffs: [],
        dryRun: true,
      };
    }

    ctx.emit(
      createEvent("stage:progress", {
        stage: "execute",
        message: `Executing ${wavesToExecute.length} waves with ${input.executionMode} mode`,
      })
    );

    // Import dynamically to avoid circular dependencies
    const { runAgent } = await import("@alfred/runtime/orchestrator/agent");
    const { buildAgentSpec } = await import(
      "@alfred/agent/orchestrator/multi/spawn"
    );
    const { AsyncQueue } = await import("@alfred/runtime/utils/concurrency");
    const {
      createTrackerContext,
      updateTrackerWithContext,
      detectStuckWithContext,
    } = await import("@alfred/agent/orchestrator/multi/tracker");

    // Get plan outputs from context (runner stores `${stage}Output` keys)
    const planOutput = ctx.get<PlanOutput>("planOutput");
    const subtasks = planOutput?.subtasks ?? [];
    const subTaskById = new Map(subtasks.map((t) => [t.id, t]));
    const execPlans = planOutput?.execPlans ?? new Map();
    const rootExecPlanPath = planOutput?.rootPlanPath ?? "";
    // Initialize TrackerContext for stuck detection
    const stuckDetectionOptions = ctx.config.stuckDetection ?? {
      noProgressMs: 60_000,
      maxTransitions: 200,
      similarityThreshold: 0.92,
    };
    let trackerContext = createTrackerContext(subtasks, stuckDetectionOptions);

    // Restore tracker metadata if resuming (not the full state)
    const savedTrackerState = ctx.get<{
      agentCount: number;
      waveCount: number;
    }>("trackerState");
    if (savedTrackerState) {
      logger.info("tracker_metadata_found", {
        runId: ctx.runId,
        agentCount: savedTrackerState.agentCount,
        waveCount: savedTrackerState.waveCount,
        note: "Full tracker state not restored - will rebuild",
      });
    }

    // Retry configuration
    const maxAttempts = ctx.config.retries?.maxAgentAttempts ?? 1;
    const retryableStatuses = new Set(
      ctx.config.retries?.retryableStatuses ?? []
    );
    const backoffMs = ctx.config.retries?.backoffMs ?? 1000;

    // Wave abort configuration
    const waveFailureThreshold =
      ctx.config.waveAbort?.waveFailureThreshold ?? 0.5;
    const overallFailureThreshold =
      ctx.config.waveAbort?.overallFailureThreshold ?? 0.3;

    // Failure tracking for wave abort
    let totalAgents = 0;
    let totalFailed = 0;
    let abortedWave: { waveId: string; reason: string } | null = null;

    try {
      // Sequential execution for POC
      for (let waveIndex = 0; waveIndex < wavesToExecute.length; waveIndex++) {
        const wave = wavesToExecute[waveIndex];
        if (!wave) {
          continue;
        }

        // Check if wave should be aborted
        if (abortedWave) {
          logger.info("wave_skipped_after_abort", {
            runId: ctx.runId,
            waveId: wave.id,
            abortedWaveId: abortedWave.waveId,
          });
          continue;
        }

        ctx.emit(
          createEvent("stage:progress", {
            stage: "execute",
            message: `Starting wave ${waveIndex + 1}/${wavesToExecute.length}`,
          })
        );

        let waveFailed = 0;
        const waveSize = wave.agents.length;

        for (const subTaskId of wave.agents) {
          const subtask = subTaskById.get(subTaskId);
          if (!subtask) {
            logger.warn("subtask_not_found", { subTaskId, runId: ctx.runId });
            continue;
          }

          // Build agent spec using actual function
          const agentSpec = buildAgentSpec(subtask, ctx.runId, ctx.workspace, {
            auto: "medium",
          });
          agentSpec.execPlanPath = execPlans.get(subtask.id) ?? "";

          ctx.emit(
            createEvent("agent:spawn", {
              agentId: agentSpec.agentId,
              taskId: agentSpec.subTaskId,
            })
          );

          totalAgents++;

          // Execute with retry logic
          let lastResult: Awaited<ReturnType<typeof runAgent>> | null = null;
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const trackerContextRef = { current: trackerContext };
              const queue = new AsyncQueue<WorkflowEvent>();
              const drainQueue = (async () => {
                for await (const event of queue) {
                  ctx.emit(
                    createEvent("agent:progress", {
                      agentId: agentSpec.agentId,
                      message: this.formatQueueEvent(event),
                    })
                  );
                }
              })();

              let result: Awaited<ReturnType<typeof runAgent>> | null = null;
              try {
                result = await runAgent({
                  spec: agentSpec,
                  phaseId: "execute",
                  runId: ctx.runId,
                  workspace: ctx.workspace,
                  workspaceRoot: ctx.workspace,
                  subTaskById,
                  projectConfig: ctx.get("projectConfig") ?? null,
                  activeWorkspaces,
                  agentFileHints: new Map(),
                  rootExecPlanPath,
                  signal: ctx.signal,
                  authz: ctx.get("authz"),
                  userId: ctx.userId,
                  trackerContextRef,
                  queue,
                });
              } finally {
                queue.close();
                await drainQueue;
              }
              if (!result) {
                throw new Error("agent_run_missing_result");
              }

              // Update tracker context after agent completion
              trackerContext = updateTrackerWithContext(trackerContext, {
                type: "agent/command",
                agentId: agentSpec.agentId,
                command: "complete",
                status: result.status === "success" ? "completed" : "failed",
                ts: Date.now(),
              });

              // Check for stuck detection
              const isStuck = detectStuckWithContext(
                trackerContext,
                agentSpec.agentId,
                Date.now()
              );

              if (isStuck && !result.stuck) {
                result.stuck = true;
                result.status = "stuck";
                ctx.emit(
                  createEvent("agent:stuck", {
                    agentId: agentSpec.agentId,
                    reason: "no_progress",
                  })
                );
              }

              // Check for escalation file
              const escalationReason = await readEscalationFile(
                agentSpec.workingDirectory,
                agentSpec.agentId
              );
              if (escalationReason && !result.escalation) {
                result.escalation = escalationReason;
                result.status = "escalated";
                ctx.emit(
                  createEvent("agent:escalated", {
                    agentId: agentSpec.agentId,
                    reason: escalationReason,
                  })
                );
              }

              lastResult = result;
              lastError = null;

              // Check if we should retry
              const shouldRetry =
                attempt < maxAttempts &&
                retryableStatuses.has(
                  result.status as "failure" | "stuck" | "timeout"
                );

              if (shouldRetry) {
                ctx.emit(
                  createEvent("agent:retry", {
                    agentId: agentSpec.agentId,
                    attempt,
                    maxAttempts,
                  })
                );
                logger.info("agent_retry", {
                  runId: ctx.runId,
                  agentId: agentSpec.agentId,
                  attempt,
                  maxAttempts,
                  status: result.status,
                });
                // Exponential backoff
                await Bun.sleep(backoffMs * attempt);
                continue;
              }

              // Success or non-retryable status
              break;
            } catch (error) {
              lastError =
                error instanceof Error ? error : new Error(String(error));

              // Check if we should retry on exception
              const shouldRetry =
                attempt < maxAttempts && retryableStatuses.has("failure");

              if (shouldRetry) {
                ctx.emit(
                  createEvent("agent:retry", {
                    agentId: agentSpec.agentId,
                    attempt,
                    maxAttempts,
                  })
                );
                logger.warn("agent_retry_on_error", {
                  runId: ctx.runId,
                  agentId: agentSpec.agentId,
                  attempt,
                  maxAttempts,
                  error: lastError.message,
                });
                await Bun.sleep(backoffMs * attempt);
              }
            }
          }

          // Process final result
          if (lastResult) {
            const outcome: AgentOutcome = {
              agentId: lastResult.agentId,
              phaseId: lastResult.phaseId,
              stuck: lastResult.stuck,
              status: lastResult.status,
              durationSeconds: lastResult.durationSeconds,
              role: lastResult.role,
              escalation: lastResult.escalation,
              result: lastResult.result,
            };

            outcomes.set(agentSpec.subTaskId, outcome);

            ctx.emit(
              createEvent("agent:complete", {
                agentId: agentSpec.agentId,
                outcome: {
                  status: lastResult.status as
                    | "success"
                    | "failure"
                    | "escalated"
                    | "timeout"
                    | "stuck",
                  durationMs: lastResult.durationSeconds * 1000,
                  handoff: lastResult.result?.summary,
                  error: lastResult.escalation,
                },
              })
            );

            // Track failures for wave abort
            if (
              lastResult.status === "failure" ||
              lastResult.status === "stuck" ||
              lastResult.escalation
            ) {
              totalFailed++;
              waveFailed++;
            }

            // Collect handoff for next agent
            if (lastResult.result?.summary) {
              handoffs.push(lastResult.result.summary);
            }

            // Collect file changes
            if (lastResult.result?.changes) {
              for (const change of lastResult.result.changes) {
                fileChanges.push({
                  path: change,
                  action: "modify",
                });
              }
            }

            logger.info("agent_complete", {
              runId: ctx.runId,
              agentId: agentSpec.agentId,
              status: lastResult.status,
              durationSeconds: lastResult.durationSeconds,
            });
          } else if (lastError) {
            // All retries failed
            const outcome: AgentOutcome = {
              agentId: agentSpec.agentId,
              phaseId: "execute",
              stuck: false,
              status: "failure",
              durationSeconds: 0,
              role: "agent",
              escalation: lastError.message,
            };

            outcomes.set(agentSpec.subTaskId, outcome);
            totalFailed++;
            waveFailed++;

            ctx.emit(
              createEvent("agent:complete", {
                agentId: agentSpec.agentId,
                outcome: {
                  status: "failure",
                  durationMs: 0,
                  error: lastError.message,
                },
              })
            );

            logger.error("agent_failed", {
              runId: ctx.runId,
              agentId: agentSpec.agentId,
              error: lastError.message,
            });
          }
        }

        // Check wave abort thresholds
        const waveFailRate = waveSize > 0 ? waveFailed / waveSize : 0;
        const overallFailRate = totalAgents > 0 ? totalFailed / totalAgents : 0;

        if (
          waveFailRate > waveFailureThreshold ||
          overallFailRate > overallFailureThreshold
        ) {
          abortedWave = { waveId: wave.id, reason: "threshold_exceeded" };
          ctx.emit(
            createEvent("wave:aborted", {
              waveId: wave.id,
              waveFailRate,
              overallFailRate,
            })
          );
          logger.warn("wave_aborted", {
            runId: ctx.runId,
            waveId: wave.id,
            waveFailRate,
            overallFailRate,
            waveThreshold: waveFailureThreshold,
            overallThreshold: overallFailureThreshold,
          });
        }
      }

      // Store tracker state for resume (only serializable metadata)
      ctx.set("trackerState", {
        agentCount: Object.keys(trackerContext.state.agents).length,
        waveCount: Object.keys(trackerContext.state.waves).length,
      });

      return {
        outcomes,
        fileChanges,
        handoffs,
      };
    } finally {
      // Mirror legacy orchestrator cleanup guarantees.
      try {
        const { stopAllServers } = await import(
          "@alfred/agent/orchestrator/tool/shared/server"
        );
        await stopAllServers("workflow_complete");
      } catch (error) {
        logger.warn("executor_server_cleanup_failed", {
          runId: ctx.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      for (const ws of activeWorkspaces) {
        try {
          await ws.cleanup();
        } catch (error) {
          logger.warn("workspace_cleanup_failed", {
            workspaceId: ws.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        const isGitWorkspace = await fs
          .stat(path.join(ctx.workspace, ".git"))
          .then(() => true)
          .catch(() => false);
        if (isGitWorkspace) {
          const { worktreeManager } = await import(
            "@alfred/agent/orchestrator/tool/worktree"
          );
          await worktreeManager.cleanup(ctx.workspace, ctx.runId);
        }
      } catch (error) {
        logger.warn("worktree_cleanup_failed", {
          runId: ctx.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Detect escalation file written by agent.
   */
}

export async function readEscalationFile(
  workDir: string,
  agentId: string
): Promise<string | null> {
  const escalationPath = path.join(workDir, `ESCALATION-${agentId}.md`);
  const file = Bun.file(escalationPath);
  if (await file.exists()) {
    const content = await file.text();
    return content.trim() || null;
  }
  return null;
}
