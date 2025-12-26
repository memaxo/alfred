import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import {
  isContainerWorkspace,
  type Workspace,
} from "@alfred/agent/environment/types";
import { runTDDLoop } from "@alfred/agent/orchestrator/loops/tdd";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import { generateSubtaskExecPlanSkeleton } from "@alfred/agent/orchestrator/multi/execplan";
import type { AgentSpec } from "@alfred/agent/orchestrator/multi/spawn";
import {
  detectStuckWithContext,
  type TrackerContext,
  updateTrackerWithContext,
} from "@alfred/agent/orchestrator/multi/tracker";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { formatCodexRuntimeError } from "../utils/codex-error";
import type { AsyncQueue } from "../utils/concurrency";
import { appendDecisionEntry, appendPlanProgressEntry } from "./execplan";
import { normalizeWorkingDirectory } from "./hydrate";
import type { ProjectConfig } from "./types";

const ENABLE_WORKSPACE_SESSIONS = process.env.ORCH_ENABLE_SESSIONS !== "0";

export type RunAgentOptions = {
  spec: AgentSpec;
  phaseId?: string; // New
  runId: string;
  workspace: string;
  workspaceRoot: string;
  subTaskById: Map<string, SubTask>;
  projectConfig: ProjectConfig | null | undefined;
  activeWorkspaces: Workspace[];
  agentFileHints: Map<string, Set<string>>;
  rootExecPlanPath: string;
  signal: AbortSignal;
  authz?: string;
  userId?: string;
  trackerContextRef: { current: TrackerContext };
  queue: AsyncQueue<WorkflowEvent>;
};

export type AgentOutcome = {
  agentId: string;
  phaseId?: string; // New
  stuck: boolean;
  status: string;
  durationSeconds: number;
  role: string;
  escalation?: string;
  result?: {
    summary: string;
    artifacts: string[];
    changes: string[];
    notes: string[];
    branch?: string;
  };
};

/**
 * Run a single agent within a wave.
 * Handles workspace creation, TDD loop, codex execution, and error recovery.
 */
export async function runAgent({
  spec,
  phaseId,
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
}: RunAgentOptions): Promise<AgentOutcome> {
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
    }
  }

  const execPlanRelativePath = spec.execPlanPath;
  const execPlanAbsolutePath = path.resolve(workspace, execPlanRelativePath);
  const dir = path.dirname(execPlanAbsolutePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(execPlanAbsolutePath);
  } catch {
    if (task) {
      const skeleton = generateSubtaskExecPlanSkeleton(task, runId);
      await Bun.write(execPlanAbsolutePath, skeleton);
    }
  }

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

  const clarifications = (spec.context as any)?.clarifications as
    | Array<{ response: string }>
    | undefined;
  const prompt = buildAgentPrompt(
    spec,
    task,
    execPlanPromptPath,
    escalationFile,
    clarifications
  );

  const writer = createAgentWriter(
    spec,
    trackerContextRef,
    agentFileHints,
    queue
  );

  // Phase 4: Test-Driven Development Loop
  if (spec.mandateTDD && projectConfig) {
    queue.enqueue({
      type: "notice",
      message: "tdd_test_generation_started",
    } as any);

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

      const interruptFinishedAt = Date.now();
      const interruptDurationSeconds = Math.max(
        0,
        (interruptFinishedAt - startedAt) / 1000
      );
      return {
        agentId: spec.agentId,
        phaseId,
        stuck: false,
        status: "interrupted",
        durationSeconds: interruptDurationSeconds,
        role: spec.agentType ?? "codex",
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

    status = "failed";
  }

  const finishedAt = Date.now();

  // Use context-aware stuck detection
  stuck = detectStuckWithContext(
    trackerContextRef.current,
    spec.agentId as any,
    Date.now()
  );
  const trackerAgent =
    trackerContextRef.current.state.agents[spec.agentId as any];
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
    const escalationPath = path.join(spec.workingDirectory, escalationFile);
    const escalationFileObj = Bun.file(escalationPath);
    if (await escalationFileObj.exists()) {
      const escalationContent = await escalationFileObj.text();
      if (escalationContent.trim().length > 0) {
        escalationReason = escalationContent;
        logger.warn("agent_escalated", {
          agentId: spec.agentId,
          reason: escalationReason,
        });
      }
    }

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
    phaseId,
    stuck,
    status,
    durationSeconds,
    role: spec.agentType ?? "codex",
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

function buildAgentPrompt(
  spec: AgentSpec,
  task: SubTask | undefined,
  execPlanPromptPath: string,
  escalationFile: string,
  clarifications?: Array<{ response: string }>
): string {
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
    if (spec.context.handoff) {
      promptLines.push("");
      promptLines.push("Context from previous steps:");
      promptLines.push(spec.context.handoff);
    }
    if (clarifications && clarifications.length > 0) {
      promptLines.push("");
      promptLines.push("User clarifications:");
      for (const c of clarifications) {
        promptLines.push(`- ${c.response}`);
      }
    }
  }

  return promptLines.join("\n");
}

function createAgentWriter(
  spec: AgentSpec,
  trackerContextRef: { current: TrackerContext },
  agentFileHints: Map<string, Set<string>>,
  queue: AsyncQueue<WorkflowEvent>
) {
  return {
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
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "codex/thought",
                agentId: spec.agentId,
                text: inner.content ?? "",
                ts,
              }
            );
          } else if (inner.type === "command") {
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
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
              }
            );
          } else if (inner.type === "artifact") {
            const filePath = inner.path ?? "";
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "codex/file",
                agentId: spec.agentId,
                path: filePath,
                kind: inner.kind ?? "file",
                ts,
              }
            );
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
}
