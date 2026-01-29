import type { Workspace } from "@alfred/agent/environment/types";
import type { WorkflowEvent } from "@alfred/type";

import {
  AGENT_ESCALATION_REASONS,
  type AgentEscalationReason,
} from "@alfred/agent/orchestrator/tool/shared/context";
import { getClassificationModel } from "@alfred/agent/selector";
import { judgeSignals } from "@alfred/agent/signals/judge";
import { logger } from "@alfred/logger";
import { RuntimeMcpServer } from "@alfred/mcp";
import {
  signalsDetectedTotal,
  signalsInterventionsTotal,
  signalsJudgeLatencySeconds,
} from "@alfred/metrics";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { PipelineContext, PipelineStage } from "../pipeline";
import type {
  AgentOutcome,
  ExecuteOutput,
  FileChange,
  PlanOutput,
  ScheduleOutput,
} from "./types";

import { createEvent } from "../events";

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
export class ExecuteStage implements PipelineStage<
  ScheduleOutput,
  ExecuteOutput
> {
  readonly name = "execute" as const;

  private normalizeId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private coerceEscalationReason(value: unknown): AgentEscalationReason {
    if (typeof value === "string") {
      const v = value.trim();
      if ((Object.values(AGENT_ESCALATION_REASONS) as string[]).includes(v)) {
        return v as AgentEscalationReason;
      }
    }
    return AGENT_ESCALATION_REASONS.OTHER;
  }

  private buildSubtaskTitle(title: string, subTaskId: string): string {
    const MAX = 240;
    const base = `${title} (${subTaskId})`.trim();
    if (base.length <= MAX) {
      return base;
    }
    return `${base.slice(0, MAX - 3)}...`;
  }

  private buildSubtaskDescription(args: {
    runId: string;
    requirement: string;
    subtask: {
      id: string;
      title: string;
      requirement: string;
      acceptance: string[];
      filesHint: string[];
    };
  }): string {
    const lines: string[] = [];
    lines.push(`Run: ${args.runId}`);
    lines.push("");
    lines.push("## Workflow");
    lines.push(args.requirement.trim());
    lines.push("");
    lines.push("## Subtask");
    lines.push(`ID: ${args.subtask.id}`);
    lines.push(args.subtask.requirement.trim());

    if (args.subtask.acceptance.length > 0) {
      lines.push("");
      lines.push("## Acceptance");
      for (const item of args.subtask.acceptance) {
        if (item.trim().length > 0) {
          lines.push(`- ${item.trim()}`);
        }
      }
    }

    if (args.subtask.filesHint.length > 0) {
      lines.push("");
      lines.push("## File hints");
      for (const hint of args.subtask.filesHint) {
        if (hint.trim().length > 0) {
          lines.push(`- ${hint.trim()}`);
        }
      }
    }

    return lines.join("\n").trim();
  }

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

    const stageAbortController = new AbortController();
    const parentAbortListener = () => {
      try {
        stageAbortController.abort();
      } catch {
        // ignore
      }
    };
    if (ctx.signal.aborted) {
      parentAbortListener();
    } else {
      ctx.signal.addEventListener("abort", parentAbortListener, { once: true });
    }

    const runtimeMcp = new RuntimeMcpServer({
      bindHost: process.env.ORCH_MCP_BIND_HOST?.trim() || "0.0.0.0",
      path: "/mcp",
      port: Number.parseInt(process.env.ORCH_MCP_PORT ?? "0", 10),
    });
    const runtimeMcpUrl = await runtimeMcp.start().then((r) => r.url);

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
          message: `Partial execution: ${wavesToExecute.length}/${input.waves.length} waves selected`,
          stage: "execute",
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
          message: `Skipping ${skipTaskIds.length} tasks`,
          stage: "execute",
        })
      );
    }

    // Dry run mode - validate only, no agent spawning
    if (dryRun) {
      ctx.emit(
        createEvent("stage:progress", {
          message: `[DRY RUN] Would execute ${wavesToExecute.length} waves with ${wavesToExecute.reduce((sum, w) => sum + w.agents.length, 0)} total agents`,
          stage: "execute",
        })
      );

      // Return mock outcomes for dry run
      for (const wave of wavesToExecute) {
        for (const agentId of wave.agents) {
          outcomes.set(agentId, {
            agentId,
            durationSeconds: 0,
            phaseId: "execute",
            result: {
              summary: "[DRY RUN] Agent not spawned",
              artifacts: [],
              changes: [],
              notes: ["Dry run - no actual execution"],
            },
            role: "agent",
            status: "success",
            stuck: false,
          });
        }
      }

      return {
        dryRun: true,
        fileChanges: [],
        handoffs: [],
        outcomes,
      };
    }

    ctx.emit(
      createEvent("stage:progress", {
        message: `Executing ${wavesToExecute.length} waves with ${input.executionMode} mode`,
        stage: "execute",
      })
    );

    // Import dynamically to avoid circular dependencies
    const { runAgent } = await import("@alfred/runtime/orchestrator/agent");
    const { buildAgentSpec } =
      await import("@alfred/agent/orchestrator/multi/spawn");
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

    // Best-effort: create per-subtask Linear issues (execute-stage only).
    try {
      const space = this.normalizeId(ctx.get("linearSpace"));
      const authz = this.normalizeId(ctx.get("linearAuthz"));
      const teamId = this.normalizeId(ctx.get("linearTeamId"));
      const rootIssueId =
        this.normalizeId(ctx.get("linearIssueId")) ??
        this.normalizeId(ctx.get("linearSessionId"));

      const selectedTaskIds = new Set<string>(
        wavesToExecute.flatMap((w) => w.agents)
      );
      const selectedSubtasks = subtasks.filter((t) =>
        selectedTaskIds.has(t.id)
      );

      if (space && authz && teamId && selectedSubtasks.length > 0) {
        const existingRaw = ctx.get("linearTaskIssueMap") as unknown;
        const existing =
          existingRaw &&
          typeof existingRaw === "object" &&
          !Array.isArray(existingRaw)
            ? (existingRaw as Record<string, string>)
            : {};
        const linearTaskIssueMap: Record<string, string> = { ...existing };

        const { toolTicket } =
          await import("@alfred/agent/orchestrator/tool/ticket");
        const { syncDepsToLinear } =
          await import("@alfred/agent/orchestrator/multi/linear-sync");

        let createdCount = 0;

        for (const subtask of selectedSubtasks) {
          if (linearTaskIssueMap[subtask.id]) {
            continue;
          }

          const title = this.buildSubtaskTitle(subtask.title, subtask.id);
          const description = this.buildSubtaskDescription({
            requirement: ctx.requirement,
            runId: ctx.runId,
            subtask: {
              id: subtask.id,
              title: subtask.title,
              requirement: subtask.requirement,
              acceptance: subtask.acceptance,
              filesHint: subtask.filesHint,
            },
          });

          try {
            const created = await toolTicket.execute({
              input: {
                action: "create",
                authz,
                description,
                space,
                teamId,
                title,
              },
            });

            const issueId = this.normalizeId(created.id);
            if (!issueId) {
              logger.warn("linear_subtask_issue_missing_id", {
                runId: ctx.runId,
                subTaskId: subtask.id,
              });
              continue;
            }

            linearTaskIssueMap[subtask.id] = issueId;
            createdCount++;

            // Persist incrementally for best-effort resume safety.
            ctx.set("linearTaskIssueMap", linearTaskIssueMap);

            // Best-effort: link root issue to subtask issue.
            if (rootIssueId) {
              try {
                await toolTicket.execute({
                  input: {
                    action: "add-relation",
                    authz,
                    issueId: rootIssueId,
                    relatedIssueId: issueId,
                    relationType: "related",
                    space,
                  },
                });
              } catch (error) {
                logger.warn("linear_subtask_relation_failed", {
                  error: error instanceof Error ? error.message : String(error),
                  issueId,
                  rootIssueId,
                  runId: ctx.runId,
                  subTaskId: subtask.id,
                });
              }
            }
          } catch (error) {
            logger.warn("linear_subtask_issue_create_failed", {
              error: error instanceof Error ? error.message : String(error),
              runId: ctx.runId,
              subTaskId: subtask.id,
            });
          }
        }

        if (createdCount > 0) {
          ctx.emit(
            createEvent("stage:progress", {
              message: `Linear: created ${createdCount} subtask issues`,
              stage: "execute",
            })
          );
        }

        // Best-effort: sync dependency edges to Linear.
        try {
          const map = new Map<string, string>(
            Object.entries(linearTaskIssueMap)
          );
          await syncDepsToLinear(
            selectedSubtasks as unknown as Parameters<
              typeof syncDepsToLinear
            >[0],
            map as unknown as Parameters<typeof syncDepsToLinear>[1],
            { authz, space }
          );
        } catch (error) {
          logger.warn("linear_subtask_deps_sync_failed", {
            error: error instanceof Error ? error.message : String(error),
            runId: ctx.runId,
          });
        }
      }
    } catch (error) {
      logger.warn("linear_subtask_issue_setup_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.runId,
      });
    }

    // Initialize TrackerContext for stuck detection
    const stuckDetectionOptions = ctx.config.stuckDetection ?? {
      maxTransitions: 200,
      noProgressMs: 60_000,
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
        agentCount: savedTrackerState.agentCount,
        note: "Full tracker state not restored - will rebuild",
        runId: ctx.runId,
        waveCount: savedTrackerState.waveCount,
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
            abortedWaveId: abortedWave.waveId,
            runId: ctx.runId,
            waveId: wave.id,
          });
          continue;
        }

        ctx.emit(
          createEvent("stage:progress", {
            message: `Starting wave ${waveIndex + 1}/${wavesToExecute.length}`,
            stage: "execute",
          })
        );

        let waveFailed = 0;
        const waveSize = wave.agents.length;

        for (const subTaskId of wave.agents) {
          const subtask = subTaskById.get(subTaskId);
          if (!subtask) {
            logger.warn("subtask_not_found", { runId: ctx.runId, subTaskId });
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
          const signalEvents: Record<string, unknown>[] = [];

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const trackerContextRef = { current: trackerContext };
              const queue = new AsyncQueue<WorkflowEvent>();
              const drainQueue = (async () => {
                for await (const event of queue) {
                  const payload = event as unknown as Record<string, unknown>;
                  // Record fact-only event traces for Signals judge.
                  // Do NOT include raw text/code; keep structured keys only.
                  const traceEntry: Record<string, unknown> = {
                    type: payload.type,
                  };
                  if (typeof payload.toolName === "string") {
                    traceEntry.toolName = payload.toolName;
                  }
                  if (typeof payload.tool === "string") {
                    traceEntry.tool = payload.tool;
                  }
                  if (typeof payload.status === "string") {
                    traceEntry.status = payload.status;
                  }
                  if (typeof payload.error === "string") {
                    traceEntry.error = true;
                  }
                  signalEvents.push(traceEntry);
                  if (signalEvents.length > 60) {
                    signalEvents.shift();
                  }

                  if (payload.type === "agent:escalate-request") {
                    ctx.emit(
                      createEvent("agent:escalate-request", {
                        agentId: String(payload.agentId ?? agentSpec.agentId),
                        details: String(payload.details ?? ""),
                        reason: this.coerceEscalationReason(payload.reason),
                        severity:
                          payload.severity === "warning"
                            ? "warning"
                            : "blocking",
                        suggestions:
                          Array.isArray(payload.suggestions) &&
                          payload.suggestions.every(
                            (s) => typeof s === "string"
                          )
                            ? (payload.suggestions as string[])
                            : undefined,
                      })
                    );

                    if (payload.severity !== "warning") {
                      ctx.set("pipelineSuspend", {
                        agentId: String(payload.agentId ?? agentSpec.agentId),
                        reason: "agent_escalation",
                      });
                      parentAbortListener();
                    }
                    continue;
                  }
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
                  activeWorkspaces,
                  agentFileHints: new Map(),
                  authz: ctx.get("authz"),
                  phaseId: "execute",
                  projectConfig: ctx.get("projectConfig") ?? null,
                  queue,
                  rootExecPlanPath,
                  runId: ctx.runId,
                  runtimeMcp: { server: runtimeMcp, url: runtimeMcpUrl },
                  signal: stageAbortController.signal,
                  spec: agentSpec,
                  subTaskById,
                  trackerContextRef,
                  userId: ctx.userId,
                  workspace: ctx.workspace,
                  workspaceRoot: ctx.workspace,
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
                agentId: agentSpec.agentId,
                command: "complete",
                status: result.status === "success" ? "completed" : "failed",
                ts: Date.now(),
                type: "agent/command",
              });

              // Trust runtime's stuck/escalation status (runtime handles real-time detection)
              // Pipeline only does secondary stuck detection as fallback
              if (!result.stuck) {
                const isStuck = detectStuckWithContext(
                  trackerContext,
                  agentSpec.agentId,
                  Date.now()
                );
                if (isStuck) {
                  result.stuck = true;
                  result.status = "stuck";
                  ctx.emit(
                    createEvent("agent:stuck", {
                      agentId: agentSpec.agentId,
                      reason: "no_progress",
                    })
                  );
                }
              } else if (result.stuck) {
                // Emit stuck event if runtime already detected it
                ctx.emit(
                  createEvent("agent:stuck", {
                    agentId: agentSpec.agentId,
                    reason: "loop_detected",
                  })
                );
              }

              // Check for escalation - runtime now handles real-time escalation via tool,
              // file-based check kept as deprecated fallback
              if (result.escalation) {
                // Emit escalated event for runtime-detected escalation
                ctx.emit(
                  createEvent("agent:escalated", {
                    agentId: agentSpec.agentId,
                    reason: result.escalation,
                  })
                );
              } else {
                const escalationReason = await readEscalationFile(
                  agentSpec.workingDirectory,
                  agentSpec.agentId
                );
                if (escalationReason) {
                  // Log deprecation warning for file-based escalation
                  logger.warn("deprecated_file_escalation", {
                    agentId: agentSpec.agentId,
                    message:
                      "File-based escalation is deprecated. Use the escalate tool instead.",
                    runId: ctx.runId,
                  });
                  result.escalation = escalationReason;
                  result.status = "escalated";
                  ctx.emit(
                    createEvent("agent:escalated", {
                      agentId: agentSpec.agentId,
                      reason: escalationReason,
                    })
                  );
                }
              }

              lastResult = result;
              lastError = null;

              // Emit LLM-judged signals for this agent attempt (abstract output).
              if (process.env.ALFRED_SIGNALS === "1") {
                try {
                  const selection = await getClassificationModel({
                    userId: ctx.userId,
                    projectId: ctx.get<string>("projectId"),
                  });
                  const stopTimer = signalsJudgeLatencySeconds.startTimer({
                    surface: "pipeline",
                    model: selection.modelKey ?? "unknown",
                  });
                  const trace = {
                    runId: ctx.runId,
                    agentId: agentSpec.agentId,
                    subTaskId: agentSpec.subTaskId,
                    attempt,
                    status: result.status,
                    stuck: !!result.stuck,
                    escalation: result.escalation ?? null,
                    events: signalEvents,
                  };
                  const judged = await judgeSignals(
                    { trace: trace as Record<string, unknown> },
                    {
                      model: selection.model,
                      abortSignal: stageAbortController.signal,
                    }
                  );
                  stopTimer();

                  for (const s of judged.friction) {
                    signalsDetectedTotal.inc({
                      surface: "pipeline",
                      kind: "friction",
                      type: s.type,
                      severity: s.severity,
                      timing: s.timing,
                    });
                  }
                  for (const s of judged.delight) {
                    signalsDetectedTotal.inc({
                      surface: "pipeline",
                      kind: "delight",
                      type: s.type,
                      severity: "na",
                      timing: "na",
                    });
                  }
                  for (const i of judged.interventions) {
                    signalsInterventionsTotal.inc({
                      surface: "pipeline",
                      action: i.action,
                      timing: i.timing,
                    });
                  }
                  ctx.emit(
                    createEvent("agent:signal", {
                      agentId: agentSpec.agentId,
                      signals: judged,
                    })
                  );
                } catch (error) {
                  logger.warn("pipeline_signals_judge_failed", {
                    agentId: agentSpec.agentId,
                    runId: ctx.runId,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }

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
                  agentId: agentSpec.agentId,
                  attempt,
                  maxAttempts,
                  runId: ctx.runId,
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
                  agentId: agentSpec.agentId,
                  attempt,
                  error: lastError.message,
                  maxAttempts,
                  runId: ctx.runId,
                });
                await Bun.sleep(backoffMs * attempt);
              }
            }
          }

          // Process final result
          if (lastResult) {
            const outcome: AgentOutcome = {
              agentId: lastResult.agentId,
              durationSeconds: lastResult.durationSeconds,
              escalation: lastResult.escalation,
              phaseId: lastResult.phaseId,
              result: lastResult.result,
              role: lastResult.role,
              status: lastResult.status,
              stuck: lastResult.stuck,
            };

            outcomes.set(agentSpec.subTaskId, outcome);

            ctx.emit(
              createEvent("agent:complete", {
                agentId: agentSpec.agentId,
                outcome: {
                  durationMs: lastResult.durationSeconds * 1000,
                  error: lastResult.escalation,
                  handoff: lastResult.result?.summary,
                  status: lastResult.status as
                    | "success"
                    | "failure"
                    | "escalated"
                    | "timeout"
                    | "stuck",
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
                  action: "modify",
                  path: change,
                });
              }
            }

            logger.info("agent_complete", {
              agentId: agentSpec.agentId,
              durationSeconds: lastResult.durationSeconds,
              runId: ctx.runId,
              status: lastResult.status,
            });
          } else if (lastError) {
            // All retries failed
            const outcome: AgentOutcome = {
              agentId: agentSpec.agentId,
              durationSeconds: 0,
              escalation: lastError.message,
              phaseId: "execute",
              role: "agent",
              status: "failure",
              stuck: false,
            };

            outcomes.set(agentSpec.subTaskId, outcome);
            totalFailed++;
            waveFailed++;

            ctx.emit(
              createEvent("agent:complete", {
                agentId: agentSpec.agentId,
                outcome: {
                  durationMs: 0,
                  error: lastError.message,
                  status: "failure",
                },
              })
            );

            logger.error("agent_failed", {
              agentId: agentSpec.agentId,
              error: lastError.message,
              runId: ctx.runId,
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
          abortedWave = { reason: "threshold_exceeded", waveId: wave.id };
          ctx.emit(
            createEvent("wave:aborted", {
              overallFailRate,
              waveFailRate,
              waveId: wave.id,
            })
          );
          logger.warn("wave_aborted", {
            overallFailRate,
            overallThreshold: overallFailureThreshold,
            runId: ctx.runId,
            waveFailRate,
            waveId: wave.id,
            waveThreshold: waveFailureThreshold,
          });
        }
      }

      // Store tracker state for resume (only serializable metadata)
      ctx.set("trackerState", {
        agentCount: Object.keys(trackerContext.state.agents).length,
        waveCount: Object.keys(trackerContext.state.waves).length,
      });

      return {
        fileChanges,
        handoffs,
        outcomes,
      };
    } finally {
      ctx.signal.removeEventListener("abort", parentAbortListener);
      try {
        await runtimeMcp.stop();
      } catch (error) {
        logger.warn("runtime_mcp_server_stop_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: ctx.runId,
        });
      }

      // Mirror legacy orchestrator cleanup guarantees.
      try {
        const { stopAllServers } =
          await import("@alfred/agent/orchestrator/tool/shared/server");
        await stopAllServers("workflow_complete");
      } catch (error) {
        logger.warn("executor_server_cleanup_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: ctx.runId,
        });
      }

      for (const ws of activeWorkspaces) {
        try {
          await ws.cleanup();
        } catch (error) {
          logger.warn("workspace_cleanup_failed", {
            error: error instanceof Error ? error.message : String(error),
            workspaceId: ws.id,
          });
        }
      }

      try {
        const isGitWorkspace = await fs
          .stat(path.join(ctx.workspace, ".git"))
          .then(() => true)
          .catch(() => false);
        if (isGitWorkspace) {
          const { worktreeManager } =
            await import("@alfred/agent/orchestrator/tool/worktree");
          await worktreeManager.cleanup(ctx.workspace, ctx.runId);
        }
      } catch (error) {
        logger.warn("worktree_cleanup_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: ctx.runId,
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
