import { realpathSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import {
  isContainerWorkspace,
  type Workspace,
} from "@alfred/agent/environment/types";
import { runTDDLoop } from "@alfred/agent/orchestrator/loops/tdd";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import {
  appendDecisionLogEntry,
  applyProgressUpdate,
  generateSubtaskExecPlanSkeleton,
} from "@alfred/agent/orchestrator/multi/execplan";
import type {
  AgentSpec,
  WavePlan,
} from "@alfred/agent/orchestrator/multi/spawn";
import {
  buildAgentSpec,
  planWaves,
} from "@alfred/agent/orchestrator/multi/spawn";
import {
  type TrackerContext,
  createTrackerContext,
  updateTrackerWithContext,
  detectStuckWithContext,
} from "@alfred/agent/orchestrator/multi/tracker";
// import { BrainstemSupervisor } from "../../loops/supervisor.js";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { openDirectorySecure } from "@alfred/agent/security/filesystem";
// import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import { ContextBuilder } from "../context";
import { AsyncQueue, pLimit } from "../utils/concurrency";
import { formatCodexRuntimeError } from "../utils/codex-error";
import type { OrchestratorContext } from "./types";

const ENABLE_WORKSPACE_SESSIONS = process.env.ORCH_ENABLE_SESSIONS !== "0";

/**
 * Hydrate tracker context from workflow history.
 * Creates a TrackerContext with dependencies initialized from subtasks.
 */
export function hydrateTrackerContext(
  history: WorkflowEvent[] | undefined,
  subTasks: SubTask[]
): TrackerContext {
  const ctx = createTrackerContext(subTasks);

  if (!history || history.length === 0) {
    return ctx;
  }

  const waveResults = history.filter((e) => (e as any).kind === "wave-result");
  for (const res of waveResults) {
    const data = (res as any).data;
    if (data?.waveId) {
      ctx.state.waves[data.waveId] = {
        status: data.status === "partial" ? "failed" : "completed",
      } as any;
    }
  }

  return ctx;
}



function normalizeWorkingDirectory(candidate: string, workspaceRoot: string) {
  // Default to workspaceRoot if candidate is empty or undefined
  const target = candidate && candidate.trim() ? candidate : workspaceRoot;
  const handle = openDirectorySecure(target, {
    allowedPrefixes: [workspaceRoot],
  });
  const normalized = handle.path;
  handle.close();
  return normalized;
}

export type WavesResult = {
  trackerContext: TrackerContext;
  allAgentOutcomes: any[];
  agentFileHints: Map<string, Set<string>>;
  activeWorkspaces: Workspace[];
  aborted: boolean;
  interrupted?: boolean;
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

// Extracted Agent Runner
type RunAgentOptions = {
  spec: AgentSpec;
  runId: string;
  workspace: string;
  workspaceRoot: string;
  subTaskById: Map<string, SubTask>;
  projectConfig: OrchestratorContext["projectConfig"];
  activeWorkspaces: Workspace[];
  agentFileHints: Map<string, Set<string>>;
  rootExecPlanPath: string;
  signal: AbortSignal;
  authz?: string;
  userId?: string;
  trackerContextRef: { current: TrackerContext };
  queue: AsyncQueue<WorkflowEvent>;
};

async function runAgent({
  spec,
  runId,
  workspace,
  workspaceRoot,
  subTaskById,
  projectConfig,
  activeWorkspaces,
  agentFileHints,
  rootExecPlanPath,
  signal,
  authz,
  userId,
  trackerContextRef,
  queue,
}: RunAgentOptions) {
  spec.workingDirectory = normalizeWorkingDirectory(
    spec.workingDirectory,
    workspaceRoot
  );
  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const task = subTaskById.get(spec.subTaskId);

  // Hybrid Tier: Handle Worktree/Container Environment via WorkspaceFactory
  let workspaceEnv: Workspace | undefined;
  let containerId: string | undefined;
  let containerCw: string | undefined;
  let poofUpperDir: string | undefined;
  let poofProfile: "minimal" | "standard" | "intensive" | undefined;
  let poofMode: "exec" | "run" | undefined;

  if (
    spec.environment === "worktree" ||
    spec.environment === "container" ||
    spec.environment === "host" ||
    spec.environment === "poof"
  ) {
    try {
      workspaceEnv = await WorkspaceFactory.create(
        spec.environment,
        spec.agentId,
        runId,
        workspace,
        {
          authz,
          enableSessions: ENABLE_WORKSPACE_SESSIONS,
          poofProfile: spec.poofProfile,
        }
      );

      await workspaceEnv.initialize();
      activeWorkspaces.push(workspaceEnv);
      spec.workingDirectory = normalizeWorkingDirectory(
        workspaceEnv.root,
        workspaceRoot
      );

      logger.info("workspace_created", {
        runId,
        agentId: spec.agentId,
        kind: spec.environment,
        root: workspaceEnv.root,
      });

      if (isContainerWorkspace(workspaceEnv)) {
        containerId = workspaceEnv.containerId;
        containerCw = workspaceEnv.containerCw;
      }
      if (spec.environment === "poof" && workspaceEnv?.kind === "poof") {
        const poof = workspaceEnv as any;
        poofUpperDir = poof.upperDir ?? poof.getUpperDir?.() ?? undefined;
        poofMode = poof.mode;
        const name = poof.profile?.name;
        poofProfile =
          name === "minimal" || name === "standard" || name === "intensive"
            ? name
            : undefined;
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
  
  // No need to set agentPlanPaths here as it was local map in runWaves, but we can't update local map easily.
  // Actually agentPlanPaths was used only for logging stuck status in runWaves?
  // We can just use execPlanAbsolutePath.

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
            trackerContextRef.current = updateTrackerWithContext(trackerContextRef.current, {
              type: "codex/thought",
              agentId: spec.agentId,
              text: inner.content ?? "",
              ts,
            });
          } else if (inner.type === "command") {
            trackerContextRef.current = updateTrackerWithContext(trackerContextRef.current, {
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
            trackerContextRef.current = updateTrackerWithContext(trackerContextRef.current, {
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
        queue.enqueue({
          type: "event",
          kind: "codex_event",
          data: payload,
        } as any);
      } else if (type === "notice") {
        queue.enqueue({
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
    queue.enqueue({ type: "notice", message: "tdd_test_generation_started" } as any);

    await runTDDLoop(
      {
        agentId: spec.agentId,
        sessionId: spec.sessionId,
        workingDirectory: spec.workingDirectory,
        execPlanPath: spec.execPlanPath,
        requirement: task?.requirement ?? "",
        auto: spec.auto === "read" ? "low" : spec.auto,
        model: spec.model,
        authz,
        signal,
        containerId,
        containerCw,
        context: spec.context,
        userId,
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

  let escalationReason: string | undefined;
  let status = "completed";
  let stuck = false;
  let durationSeconds = 0;

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
        containerCw,
        poofUpperDir,
        poofProfile,
        poofMode,
        model: spec.model,
        profile: spec.profile,
        authz,
        context: {
          linearSessionId: spec.context.linearSessionId,
          linearSpace: spec.context.linearSpace,
          linearAuthz: spec.context.linearAuthz,
          linearIssueId: spec.context.linearIssueId,
          relevantFiles: spec.context.relevantFiles,
        },
        userId,
      },
      writer,
      signal,
    });
  } catch (error: any) {
    // Handle Supervisor Interrupts
    if (String(error).includes("codex_exec_interrupted")) {
      logger.warn("agent_interrupted_by_supervisor", {
        agentId: spec.agentId,
        error: String(error),
      });
      queue.enqueue({
        type: "notice",
        message: `agent_interrupted: ${String(error)}`,
      } as any);

      // Always restore checkpoint on interrupt
      if (workspaceEnv) {
        try {
          await workspaceEnv.restore("pre-agent");
        } catch (restoreErr) {
          logger.error("restore_failed_on_interrupt", {
            agentId: spec.agentId,
            error: String(restoreErr),
          });
        }
      }

      // Mark agent as interrupted
      const interruptFinishedAt = Date.now();
      const interruptDurationSeconds = Math.max(
        0,
        (interruptFinishedAt - startedAt) / 1000
      );
      return {
        agentId: spec.agentId,
        stuck: false,
        status: "interrupted",
        durationSeconds: interruptDurationSeconds,
        role: "codex",
      };
    }

    // Restore on crash (non-interrupt errors)
    const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
      formatCodexRuntimeError(error);
    queue.enqueue({
      type: "notice",
      message: userMessage,
    } as any);
    logger.error("codex_agent_failed", {
      agentId: spec.agentId,
      error: rawMessage,
      code,
      needsElevation,
      limitExceeded,
    });

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

    // We don't re-throw here to allow other agents to continue? 
    // Wait, original code re-threw non-interrupt errors.
    // "throw error;"
    // If we throw, Promise.all rejects?
    // We should probably catch and return a failed outcome.
    status = "failed";
  }

  const finishedAt = Date.now();

  // Use context-aware stuck detection
  stuck = detectStuckWithContext(
    trackerContextRef.current,
    spec.agentId as any,
    Date.now()
  );
  const trackerAgent = trackerContextRef.current.state.agents[spec.agentId as any];
  if (status !== "failed") {
    status = trackerAgent?.status ?? (stuck ? "stuck" : "completed");
  }
  durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

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
  return {
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
  };
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
    userId,
  } = ctx;
  void runTDDLoop;

  const agentFileHints = new Map<string, Set<string>>();
  const agentSubTaskIds = new Map<string, string>();
  const activeWorkspaces: Workspace[] = [];
  const rootExecPlanPath = path.resolve(
    workspace,
    `.agent/plans/${runId}.root.md`
  );
  const workspaceRoot = realpathSync(workspace);

  const hasEscalationContext = Boolean(
    escalationContext && escalationContext.trim().length > 0
  );
  const cachedExecutionContext: ExecutionContext | null = hasEscalationContext
    ? null
    : (scanContext ?? null);

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
      userId,
    });
  }

  if (!ctx.scanContext) {
    ctx.scanContext = context;
  }

  const subTasks: SubTask[] = decomposeTask(input.requirement, {
    requirement: effectiveRequirement,
    bundle: context.bundle,
  });

  if (subTasks.length === 0) {
    yield { type: "notice", message: "no_subtasks_to_execute" } as any;
    return {
      trackerContext: createTrackerContext([]),
      allAgentOutcomes: [],
      agentFileHints,
      activeWorkspaces,
      aborted: false,
      interrupted: false,
    };
  }

  // Phase 13: Hydration - Create tracker context with subtask dependencies
  const trackerContext = hydrateTrackerContext(history, subTasks);
  const trackerContextRef = { current: trackerContext };

  const subTaskById = new Map<string, SubTask>(subTasks.map((t) => [t.id, t]));
  const maxParallelRaw = Number.parseInt(
    process.env.ORCHESTRATOR_MAX_PARALLEL || "2",
    10
  );
  const maxParallel = Number.isFinite(maxParallelRaw)
    ? Math.max(1, maxParallelRaw)
    : 2;
  const waves: WavePlan[] = planWaves(subTasks, { maxParallel });

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
  let hasInterruptedAgents = false;

  const allAgentOutcomes: any[] = [];

  for (const wave of waves) {
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }

    // Hydration check for wave
    if (trackerContextRef.current.state.waves[wave.id]?.status === "completed") {
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

    const agentSpecs: AgentSpec[] = wave.agents
      .map((id: string): AgentSpec | null => {
        const task = subTaskById.get(id);
        if (!task) {
          return null;
        }
        const spec = buildAgentSpec(task, runId, workspace, {
          auto: input.auto,
          maxParallel,
          linear: input.linear
            ? {
                issueId: input.linear.issueId,
                sessionId: input.linear.sessionId,
                space: input.linear.space,
                authz: input.linear.authz,
              }
            : undefined,
        });
        agentSubTaskIds.set(spec.agentId, spec.subTaskId);
        return spec;
      })
      .filter((spec: AgentSpec | null): spec is AgentSpec => spec !== null);

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

    trackerContextRef.current.state.waves[wave.id] = { status: "running" };

    // Concurrent Execution using pLimit and AsyncQueue
    const queue = new AsyncQueue<WorkflowEvent>();
    const limit = pLimit(maxParallel);

    const agentPromises = agentSpecs.map((spec) =>
      limit(async () => {
        try {
          return await runAgent({
            spec,
            runId,
            workspace,
            workspaceRoot,
            subTaskById,
            projectConfig,
            activeWorkspaces,
            agentFileHints,
            rootExecPlanPath,
            signal,
            authz,
            userId,
            trackerContextRef,
            queue,
          });
        } catch (error) {
          logger.error("agent_unhandled_error", {
            runId,
            agentId: spec.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
          queue.enqueue({
            type: "notice",
            message: `agent_failed_unhandled:${spec.agentId}`,
          } as any);
          return {
            agentId: spec.agentId,
            stuck: false,
            status: "failed",
            durationSeconds: 0,
            role: "codex",
            escalation: undefined,
            result: {
              summary: "agent failed (unhandled error)",
              artifacts: [],
              changes: [],
              notes: [],
            },
          } as any;
        }
      })
    );

    // Don't await promises yet; let them run and push events.
    const allAgentsDone = Promise.all(agentPromises).finally(() => {
      queue.close();
    });

    // Stream events from queue
    for await (const ev of queue) {
      yield ev;
    }

    const agentOutcomes = await allAgentsDone;

    // Process outcomes
    for (const outcome of agentOutcomes) {
        if (outcome.status === "interrupted") {
            hasInterruptedAgents = true;
        }
        if (outcome.escalation) {
            escalationTrigger = { reason: outcome.escalation };
        }
    }

    const anyStuck = agentOutcomes.some((o) => o.stuck);
    trackerContextRef.current.state.waves[wave.id] = {
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
    trackerContext: trackerContextRef.current,
    allAgentOutcomes,
    agentFileHints,
    activeWorkspaces,
    aborted: !!abortedWave,
    interrupted: hasInterruptedAgents,
    escalated: !!escalationTrigger,
    escalationReason: escalationTrigger?.reason,
  };
}
