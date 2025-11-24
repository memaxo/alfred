import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
import { runTDDLoop } from "@alfred/agent/orchestrator/loops/tdd";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import {
  applyProgressUpdate,
  appendDecisionLogEntry,
  generateSubtaskExecPlanSkeleton,
} from "@alfred/agent/orchestrator/multi/execplan";
import {
  buildAgentSpec,
  planWaves,
} from "@alfred/agent/orchestrator/multi/spawn";
import {
  detectNeedsGuidance,
  detectStuck,
  type TrackerState,
  updateTracker,
} from "@alfred/agent/orchestrator/multi/tracker";
// import { BrainstemSupervisor } from "../../loops/supervisor.js";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
// import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../context";
import type { ExecutionContext } from "../context";
import type { OrchestratorContext } from "./types";

const ENABLE_WORKSPACE_SESSIONS =
  process.env.ORCH_ENABLE_SESSIONS !== "0";

export type WavesResult = {
  trackerState: TrackerState;
  allAgentOutcomes: any[];
  agentFileHints: Map<string, Set<string>>;
  activeWorkspaces: Workspace[];
  aborted: boolean;
  escalated?: boolean;
  escalationReason?: string;
};

async function mutateExecPlanFile(
  filePath: string,
  mutate: (markdown: string) => string
) {
  let current = "";
  try {
    current = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn("execplan_read_failed", {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    } catch (mkdirErr) {
      logger.warn("execplan_dir_failed", {
        path: filePath,
        error: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
      });
      return;
    }
  }

  const updated = mutate(current);
  if (updated === current) {
    return;
  }
  try {
    await fs.writeFile(filePath, updated, "utf8");
  } catch (error) {
    logger.warn("execplan_write_failed", {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function appendPlanProgressEntry(
  filePath: string,
  message: string,
  completed: boolean
) {
  const timestampIso = new Date().toISOString();
  await mutateExecPlanFile(filePath, (markdown) =>
    applyProgressUpdate(markdown, {
      timestampIso,
      message,
      completed,
    })
  );
}

async function appendDecisionEntry(
  filePath: string,
  decision: string,
  rationale?: string,
  note?: string
) {
  const timestampIso = new Date().toISOString();
  await mutateExecPlanFile(filePath, (markdown) =>
    appendDecisionLogEntry(markdown, {
      decision,
      rationale,
      note,
      dateIso: timestampIso,
      author: "runtime",
    })
  );
}

export async function* runWaves(
  ctx: OrchestratorContext
): AsyncGenerator<WorkflowEvent, WavesResult, void> {
  const {
    input,
    runId,
    signal,
    workspace,
    history,
    projectConfig,
    escalationContext,
    authz,
    scanContext,
  } = ctx;
  void runTDDLoop;

  // Phase 13: Hydration - Rebuild Tracker State
  let trackerState: TrackerState = { agents: {}, waves: {} };

  if (history) {
    const waveResults = history.filter(
      (e) => (e as any).kind === "wave-result"
    );
    for (const res of waveResults) {
      const data = (res as any).data;
      if (data?.waveId) {
        trackerState.waves[data.waveId] = {
          status: data.status === "partial" ? "failed" : "completed",
        } as any;
      }
    }
  }

  const agentFileHints = new Map<string, Set<string>>();
  const agentSubTaskIds = new Map<string, string>();
  const activeWorkspaces: Workspace[] = [];
  const agentPlanPaths = new Map<
    string,
    { absolute: string; relative: string }
  >();
  const rootExecPlanPath = path.resolve(
    workspace,
    `.agent/plans/${runId}.root.md`
  );

  const hasEscalationContext = Boolean(
    escalationContext && escalationContext.trim().length > 0
  );
  const cachedExecutionContext: ExecutionContext | null = hasEscalationContext
    ? null
    : scanContext ?? null;

  const effectiveRequirement = hasEscalationContext
    ? `${input.requirement}\n\nESCALATION CONTEXT: ${escalationContext}`
    : input.requirement;

  let context: ExecutionContext;
  if (cachedExecutionContext) {
    context = cachedExecutionContext;
    yield {
      type: "notice",
      message: "waves_using_cached_context",
    } as WorkflowEvent;
  } else {
    const builder = new ContextBuilder();
    context = await builder.build({
      requirement: effectiveRequirement,
      workspace,
      repoBase: input.repoBase,
      web: input.context?.web,
      topK: input.context?.topK,
      maxTokens: input.context?.maxTokens,
      exts: input.context?.exts,
      ignore: input.context?.ignore,
      seeds: input.context?.seeds,
      authz: undefined,
    });
  }

  if (!ctx.scanContext) {
    ctx.scanContext = context;
  }

  const subTasks = decomposeTask(input.requirement, {
    requirement: effectiveRequirement,
    bundle: context.bundle,
  });

  if (subTasks.length === 0) {
    yield { type: "notice", message: "no_subtasks_to_execute" } as any;
    return {
      trackerState,
      allAgentOutcomes: [],
      agentFileHints,
      activeWorkspaces,
      aborted: false,
    };
  }

  const subTaskById = new Map(subTasks.map((t) => [t.id, t]));
  const maxParallel = Number.parseInt(
    process.env.ORCHESTRATOR_MAX_PARALLEL || "2",
    10
  );
  const waves = planWaves(subTasks, { maxParallel });

  if (waves.length === 0) {
    // Fallback: treat all subtasks as a single wave.
    waves.push({
      id: "wave_0",
      agents: subTasks.map((t) => t.id),
      dependsOn: [],
    });
  }

  // Track aggregate failure rates for abort heuristics (Phase 6)
  let totalAgents = 0;
  let totalFailedOrStuck = 0;
  let abortedWave: {
    id: string;
    waveFailRate: number;
    overallFailRate: number;
  } | null = null;

  let escalationTrigger: { reason: string } | null = null;

  const allAgentOutcomes: any[] = [];

  for (const wave of waves) {
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }

    // Hydration check for wave
    if (trackerState.waves[wave.id]?.status === "completed") {
      logger.info("wave_hydrated_skipping", { waveId: wave.id });
      yield {
        type: "notice",
        message: `wave_${wave.id}_skipped_already_completed`,
      } as any;
      continue;
    }

    logger.info("multi_agent_wave_start", {
      runId,
      waveId: wave.id,
      agentCount: wave.agents.length,
    });

    yield {
      type: "notice",
      message: `wave_${wave.id}_start`,
    } as any;

    const agentSpecs = wave.agents
      .map((id) => {
        const task = subTaskById.get(id);
        if (!task) {
          return null;
        }
        const spec = buildAgentSpec(task, runId, workspace, {
          auto: input.auto as any,
          linear: input.linear
            ? {
                issueId: undefined,
                sessionId: input.linear.sessionId,
                space: input.linear.space,
                authz: input.linear.authz,
              }
            : undefined,
        });
        agentSubTaskIds.set(spec.agentId, spec.subTaskId);
        return spec;
      })
      .filter((spec): spec is ReturnType<typeof buildAgentSpec> =>
        Boolean(spec)
      );

    yield {
      type: "event",
      kind: "data-wave-plan",
      data: {
        waveId: wave.id,
        agents: agentSpecs,
        dependsOn: wave.dependsOn,
      },
    } as any;

    await appendPlanProgressEntry(
      rootExecPlanPath,
      `Wave ${wave.id} started with ${agentSpecs.length} agent(s).`,
      false
    );

    const waveEvents: WorkflowEvent[] = [];

    trackerState.waves[wave.id] = { status: "running" };

    const agentOutcomes: Array<{
      agentId: string;
      stuck: boolean;
      status: string;
      durationSeconds: number;
      role: string;
      result?: any;
      escalation?: string;
    }> = [];

    for (const spec of agentSpecs) {
      if (signal.aborted) {
        throw new DOMException("Phase aborted", "AbortError");
      }

      const task = subTaskById.get(spec.subTaskId);

      // Hybrid Tier: Handle Worktree/Container Environment via WorkspaceFactory
      let workspaceEnv: Workspace | undefined;
      let containerId: string | undefined;

      if (
        spec.environment === "worktree" ||
        spec.environment === "container" ||
        spec.environment === "host"
      ) {
        try {
          workspaceEnv = await WorkspaceFactory.create(
            spec.environment,
            spec.agentId,
            runId,
            workspace,
            {
              authz: input.linear?.authz,
              enableSessions: ENABLE_WORKSPACE_SESSIONS,
            }
          );

          await workspaceEnv.initialize();
          activeWorkspaces.push(workspaceEnv);
          spec.workingDirectory = workspaceEnv.root;

          logger.info("workspace_created", {
            runId,
            agentId: spec.agentId,
            kind: spec.environment,
            root: workspaceEnv.root,
          });

          if (spec.environment === "container") {
            // Extract containerId from ContainerWorkspace
            containerId = (workspaceEnv as any).containerId;
          }
        } catch (error) {
          logger.warn("workspace_creation_failed", {
            runId,
            agentId: spec.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Abort this agent? Or continue on host?
          // Continue implies running in main repo, which might be dangerous.
          // For now, we proceed (fallback to spec.workingDirectory which was repo root).
        }
      }

      const execPlanRelativePath = spec.execPlanPath;
      const execPlanAbsolutePath = path.resolve(
        workspace,
        execPlanRelativePath
      );
      const dir = path.dirname(execPlanAbsolutePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        await fs.access(execPlanAbsolutePath);
      } catch {
        if (task) {
          const skeleton = generateSubtaskExecPlanSkeleton(task, runId);
          await fs.writeFile(execPlanAbsolutePath, skeleton, "utf8");
        }
      }
      agentPlanPaths.set(spec.agentId, {
        absolute: execPlanAbsolutePath,
        relative: execPlanRelativePath,
      });

      const execPlanPromptPath = execPlanRelativePath;

      if (execPlanAbsolutePath) {
        await appendPlanProgressEntry(
          execPlanAbsolutePath,
          `Agent ${spec.agentId} started ${task?.title ?? spec.subTaskId}.`,
          false
        );
      }

      const safeAgentId = spec.agentId.replace(/[^a-zA-Z0-9.-]/g, "_");
      const escalationFile = `ESCALATION-${safeAgentId}.md`;

      const promptLines = [
        "You are a coding agent executing a single subtask ExecPlan.",
        "",
        `ExecPlan path: ${execPlanPromptPath}`,
        "",
        "Instructions:",
        "- Read the ExecPlan file at the given path.",
        "- Update the Progress and Decision Log sections as you work.",
        "- Make small, idempotent edits to both the ExecPlan and the code.",
        "- Prefer minimal, safe changes that can be retried without harm.",
        `- If you encounter a blocking issue that requires re-planning (e.g. missing dependency, wrong architecture), write a file named '${escalationFile}' with the reason and exit.`,
        "- At the end, summarise what you changed.",
      ];

      if (task) {
        promptLines.push("");
        promptLines.push("Subtask requirement:");
        promptLines.push(task.requirement);
        if (task.acceptance.length > 0) {
          promptLines.push("");
          promptLines.push("Acceptance criteria:");
          for (const criterion of task.acceptance) {
            promptLines.push(`- ${criterion}`);
          }
        }
        if (task.filesHint.length > 0) {
          promptLines.push("");
          promptLines.push("Suggested focus areas:");
          for (const prefix of task.filesHint) {
            promptLines.push(`- ${prefix}`);
          }
        }
      }

      const prompt = promptLines.join("\n");

      const bufferedEvents: WorkflowEvent[] = [];

      const writer = {
        write: async (chunk: unknown) => {
          const payload = chunk as { type?: string; event?: unknown };
          if (!payload || typeof payload !== "object") {
            return;
          }
          const type = (payload as any).type;

          if (type === "stdout" || type === "stderr") {
            const inner = (payload as any).event as
              | {
                  type?: string;
                  content?: string;
                  timestamp?: number;
                  command?: string;
                  status?: string;
                  path?: string;
                  kind?: string;
                }
              | undefined;
            if (inner && typeof inner.type === "string") {
              const ts =
                typeof inner.timestamp === "number" &&
                Number.isFinite(inner.timestamp)
                  ? inner.timestamp
                  : Date.now();
              if (inner.type === "thought") {
                trackerState = updateTracker(trackerState, {
                  type: "codex/thought",
                  agentId: spec.agentId,
                  text: inner.content ?? "",
                  ts,
                });
                const needsGuidance = detectNeedsGuidance(
                  trackerState,
                  spec.agentId as any,
                  [inner.content ?? ""]
                );
                if (needsGuidance) {
                  const agentState = trackerState.agents[spec.agentId as any];
                  if (agentState) {
                    agentState.status = "paused";
                  }
                  bufferedEvents.push({
                    type: "notice",
                    message: "agent_needs_guidance",
                  } as any);
                }
              } else if (inner.type === "command") {
                trackerState = updateTracker(trackerState, {
                  type: "codex/command",
                  agentId: spec.agentId,
                  command: inner.command ?? "",
                  status:
                    inner.status === "failed"
                      ? "failed"
                      : inner.status === "completed"
                        ? "completed"
                        : "running",
                  ts,
                });
              } else if (inner.type === "artifact") {
                const filePath = inner.path ?? "";
                trackerState = updateTracker(trackerState, {
                  type: "codex/file",
                  agentId: spec.agentId,
                  path: filePath,
                  kind: inner.kind ?? "file",
                  ts,
                });
                if (filePath) {
                  let set = agentFileHints.get(spec.agentId);
                  if (!set) {
                    set = new Set<string>();
                    agentFileHints.set(spec.agentId, set);
                  }
                  set.add(filePath);
                }
              }
            }
            bufferedEvents.push({
              type: "event",
              kind: "codex_event",
              data: payload,
            } as any);
          } else if (type === "notice") {
            bufferedEvents.push({
              type: "notice",
              message: (payload as any).message ?? "codex_notice",
            } as any);
          }
        },
      } as const;

      // Phase 4: Test-Driven Development Loop
      // If mandated, we first force the agent to write a failing test.
      if (spec.mandateTDD && projectConfig) {
        const task = subTaskById.get(spec.subTaskId);
        yield { type: "notice", message: "tdd_test_generation_started" } as any;

        await runTDDLoop(
          {
            agentId: spec.agentId,
            sessionId: spec.sessionId,
            workingDirectory: spec.workingDirectory,
            execPlanPath: spec.execPlanPath,
            requirement: task?.requirement ?? "",
            auto: spec.auto as any,
            model: spec.model,
            containerId,
            context: spec.context,
          },
          projectConfig,
          workspaceEnv,
          writer
        );
      }

      const startedAt = Date.now();

      // Checkpoint before execution
      if (workspaceEnv) {
        try {
          await workspaceEnv.checkpoint("pre-agent");
        } catch (err) {
          logger.warn("checkpoint_failed", {
            agentId: spec.agentId,
            error: String(err),
          });
        }
      }

      try {
        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: spec.auto,
            cw: spec.workingDirectory,
            sessionId: spec.sessionId,
            containerId,
            model: spec.model,
            profile: spec.profile,
            authz, // Pass authz from context
            context: {
              linearSessionId: spec.context.linearSessionId,
              linearSpace: spec.context.linearSpace,
              linearAuthz: spec.context.linearAuthz,
              linearIssueId: spec.context.linearIssueId,
              relevantFiles: spec.context.relevantFiles,
            },
          },
          writer,
        });
      } catch (error: any) {
        // Handle Supervisor Interrupts
        if (String(error).includes("codex_exec_interrupted")) {
          logger.warn("agent_interrupted_by_supervisor", {
            agentId: spec.agentId,
            error: String(error),
          });
          bufferedEvents.push({
            type: "notice",
            message: `agent_interrupted: ${String(error)}`,
          } as any);
          // Treat as a failure but don't crash the whole orchestrator
          // We will rely on the outcome push below to record status
          // But we need to ensure 'agentOutcomes' gets an entry.
          // Actually, if we catch here, we proceed to 'finishedAt'.
          // We should probably restore checkpoint too if interrupted?
        }

        // Restore on crash or interrupt
        if (workspaceEnv) {
          logger.warn("agent_crashed_restoring_checkpoint", {
            agentId: spec.agentId,
          });
          try {
            await workspaceEnv.restore("pre-agent");
          } catch (restoreErr) {
            logger.error("restore_failed", {
              agentId: spec.agentId,
              error: String(restoreErr),
            });
          }
        }

        if (!String(error).includes("codex_exec_interrupted")) {
          throw error;
        }
      }

      const finishedAt = Date.now();

      for (const ev of bufferedEvents) {
        yield ev;
        waveEvents.push(ev);
      }

      const stuck = detectStuck(trackerState, spec.agentId as any, Date.now());
      const trackerAgent = trackerState.agents[spec.agentId as any];
      const status = trackerAgent?.status ?? (stuck ? "stuck" : "completed");
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

      if (execPlanAbsolutePath) {
        const statusLabel = stuck ? "stuck" : status;
        const durationLabel = durationSeconds.toFixed(1);
        await appendPlanProgressEntry(
          execPlanAbsolutePath,
          `Agent ${spec.agentId} ${statusLabel} in ${durationLabel}s.`,
          !stuck && status === "completed"
        );
        if (stuck || status === "failed") {
          await appendDecisionEntry(
            execPlanAbsolutePath,
            `Agent flagged ${statusLabel}`,
            "Runtime detected the agent did not complete cleanly."
          );
        }
      }

      // Check for Escalation
      let escalationReason: string | undefined;
      try {
        const safeAgentId = spec.agentId.replace(/[^a-zA-Z0-9.-]/g, "_");
        const escalationFile = `ESCALATION-${safeAgentId}.md`;
        const escalationPath = path.join(spec.workingDirectory, escalationFile);
        const escalationContent = await fs.readFile(escalationPath, "utf8");
        if (escalationContent.trim().length > 0) {
          escalationReason = escalationContent;
          logger.warn("agent_escalated", {
            agentId: spec.agentId,
            reason: escalationReason,
          });

          escalationTrigger = { reason: escalationReason };

          if (execPlanAbsolutePath) {
            await appendDecisionEntry(
              execPlanAbsolutePath,
              "Escalated",
              escalationReason
            );
          }
          await appendDecisionEntry(
            rootExecPlanPath,
            `Subtask ${spec.subTaskId} escalated`,
            escalationReason,
            `Agent ${spec.agentId}`
          );
        }
      } catch {
        // No escalation file found
      }

      const hints = agentFileHints.get(spec.agentId);
      agentOutcomes.push({
        agentId: spec.agentId,
        stuck,
        status,
        durationSeconds,
        role: "codex",
        escalation: escalationReason,
        result: {
          summary: "codex agent execution",
          artifacts: [],
          changes: hints ? Array.from(hints) : [],
          notes: [],
          branch: workspaceEnv?.branch ?? undefined,
        },
      });
    }

    const anyStuck = agentOutcomes.some((o) => o.stuck);
    trackerState.waves[wave.id] = {
      status: anyStuck ? "failed" : "completed",
    } as any;

    logger.info("multi_agent_wave_result", {
      runId,
      waveId: wave.id,
      status: anyStuck ? "partial" : "completed",
      agentCount: agentOutcomes.length,
      failedOrStuck: agentOutcomes.filter(
        (o) => o.stuck || o.status === "failed" || o.status === "stuck"
      ).length,
    });

    yield {
      type: "event",
      kind: "wave-result",
      data: {
        waveId: wave.id,
        status: anyStuck ? "partial" : "completed",
        agents: agentOutcomes,
      },
    } as any;

    await appendPlanProgressEntry(
      rootExecPlanPath,
      `Wave ${wave.id} ${anyStuck ? "completed with blockers" : "completed successfully"}.`,
      !anyStuck
    );
    if (anyStuck) {
      await appendDecisionEntry(
        rootExecPlanPath,
        `Wave ${wave.id} encountered blockers`,
        "One or more agents were stuck or failed; review subtask ExecPlans for details."
      );
    }

    // Stop waves if escalated
    if (escalationTrigger) {
      break;
    }

    const waveTotal = agentOutcomes.length;
    const waveFailedOrStuck = agentOutcomes.filter((o) => {
      const status = o.status;
      return o.stuck || status === "failed" || status === "stuck";
    }).length;

    totalAgents += waveTotal;
    totalFailedOrStuck += waveFailedOrStuck;

    allAgentOutcomes.push(...agentOutcomes);

    const waveFailRate = waveTotal > 0 ? waveFailedOrStuck / waveTotal : 0;
    const overallFailRate =
      totalAgents > 0 ? totalFailedOrStuck / totalAgents : 0;

    if (waveFailRate > 0.5 || overallFailRate > 0.4) {
      abortedWave = {
        id: wave.id,
        waveFailRate,
        overallFailRate,
      };
      logger.warn("multi_agent_wave_aborted", {
        runId,
        waveId: wave.id,
        waveFailRate,
        overallFailRate,
      });
      break;
    }

    // Wave Merge & Arbitration Phase
    // For agents that succeeded in worktrees, try to merge their branches.
    // If conflict, spawn Arbiter.
    const successfulAgents = agentOutcomes.filter(
      (o) => o.status === "completed" && !o.stuck
    );

    for (const outcome of successfulAgents) {
      const spec = agentSpecs.find((s) => s.agentId === outcome.agentId);
      if (spec?.environment === "worktree") {
        const targetBranch = process.env.ORCH_TARGET_BRANCH ?? "dev";
        const sourceBranch = `agent/${runId}/${spec.agentId}`;

        try {
          const { worktreeManager } = await import(
            "@alfred/agent/orchestrator/tool/worktree"
          );
          const mergeCheck = await worktreeManager.safeMerge(
            workspace,
            targetBranch,
            sourceBranch,
            { runId }
          );

          if (mergeCheck.success) {
            const proc = Bun.spawn(["git", "merge", sourceBranch], {
              cwd: workspace,
            });
            await proc.exited;
          } else {
            logger.warn("merge_conflict_detected", {
              runId,
              agentId: spec.agentId,
              files: mergeCheck.conflictFiles,
            });

            yield {
              type: "notice",
              message: `merge_conflict_detected:${spec.agentId}`,
            } as any;

            const { conflictArbiter } = await import(
              "@alfred/agent/orchestrator/conflict"
            );
            const resolution = await conflictArbiter.resolve(
              workspace,
              runId,
              targetBranch,
              sourceBranch,
              authz
            );

            if (resolution.status === "resolved") {
              logger.info("arbiter_resolved_conflict", {
                runId,
                agentId: spec.agentId,
                resolutionBranch: resolution.resolvedBranch,
              });
              yield {
                type: "notice",
                message: `arbiter_resolved:${spec.agentId}`,
              } as any;

              const proc = Bun.spawn(
                ["git", "merge", resolution.resolvedBranch],
                { cwd: workspace }
              );
              await proc.exited;
            } else {
              logger.error("arbiter_failed_resolution", {
                runId,
                agentId: spec.agentId,
                reason: resolution.reason,
              });
              yield {
                type: "notice",
                message: `arbiter_failed:${spec.agentId}`,
              } as any;
            }
          }
        } catch (err) {
          logger.error("merge_check_failed", {
            agentId: spec.agentId,
            error: String(err),
          });
        }
      }
    }
  }

  if (abortedWave) {
    yield {
      type: "event",
      kind: "wave-aborted",
      data: {
        waveId: abortedWave.id,
        waveFailRate: abortedWave.waveFailRate,
        overallFailRate: abortedWave.overallFailRate,
      },
    } as any;

    await appendDecisionEntry(
      rootExecPlanPath,
      `Wave ${abortedWave.id} aborted`,
      `Wave fail rate ${abortedWave.waveFailRate.toFixed(2)}, overall ${abortedWave.overallFailRate.toFixed(2)}`
    );

    // Cleanup worktrees on abort
    for (const ws of activeWorkspaces) {
      try {
        await ws.cleanup();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    trackerState,
    allAgentOutcomes,
    agentFileHints,
    activeWorkspaces,
    aborted: !!abortedWave,
    escalated: !!escalationTrigger,
    escalationReason: escalationTrigger?.reason,
  };
}
