import * as path from "node:path";
import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type {
  AgentOutcome,
  ExecuteOutput,
  FileChange,
  ScheduleOutput,
  SubTask,
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

  async execute(
    input: ScheduleOutput,
    ctx: PipelineContext
  ): Promise<ExecuteOutput> {
    const outcomes = new Map<string, AgentOutcome>();
    const fileChanges: FileChange[] = [];
    const handoffs: string[] = [];

    ctx.emit(
      createEvent("stage:progress", {
        stage: "execute",
        message: `Executing ${input.waves.length} waves with ${input.executionMode} mode`,
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

    // Get subtasks and exec plans from context
    const subtasks = ctx.get<SubTask[]>("subtasks") ?? [];
    const subTaskById = new Map(subtasks.map((t) => [t.id, t]));
    const execPlans = ctx.get<Map<string, string>>("execPlans") ?? new Map();
    const rootExecPlanPath = ctx.get<string>("rootPlanPath") ?? "";
    const queue = new AsyncQueue();

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

    // Sequential execution for POC
    for (let waveIndex = 0; waveIndex < input.waves.length; waveIndex++) {
      const wave = input.waves[waveIndex];
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
          message: `Starting wave ${waveIndex + 1}/${input.waves.length}`,
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

            const result = await runAgent({
              spec: agentSpec,
              phaseId: "execute",
              runId: ctx.runId,
              workspace: ctx.workspace,
              workspaceRoot: ctx.workspace,
              subTaskById,
              projectConfig: ctx.get("projectConfig") ?? null,
              activeWorkspaces: [],
              agentFileHints: new Map(),
              rootExecPlanPath,
              signal: ctx.signal,
              authz: ctx.get("authz"),
              userId: ctx.userId,
              trackerContextRef,
              queue:
                queue as unknown as import("@alfred/runtime/utils/concurrency").AsyncQueue<
                  import("@alfred/type").WorkflowEvent
                >,
            });

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
            const escalationReason = await this.detectEscalation(
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
      agentCount: trackerContext.state.agents.size,
      waveCount: trackerContext.state.waves.length,
    });

    // Store execute output in context for summarize stage
    const executeOutput: ExecuteOutput = {
      outcomes,
      fileChanges,
      handoffs,
    };

    // Don't store complex execute output - it contains non-serializable data
    // The execute stage result is returned directly, not persisted for resume

    return executeOutput;
  }

  /**
   * Detect escalation file written by agent.
   */
  private async detectEscalation(
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
}
