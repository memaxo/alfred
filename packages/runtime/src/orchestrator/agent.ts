import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isAgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
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

type AgentExecutor = "codex" | "droid" | "opencode";

function normalizeAgentType(raw: unknown): AgentExecutor {
  if (typeof raw !== "string") {
    return "codex";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "droid" || normalized === "opencode") {
    return normalized;
  }
  return "codex";
}

type ExecProfile = "default" | "server";

function normalizeExecProfile(raw: unknown): ExecProfile | undefined {
  if (typeof raw !== "string") {
    return;
  }
  const v = raw.trim().toLowerCase();
  if (v === "server") {
    return "server";
  }
  if (v === "default") {
    return "default";
  }
  return;
}

function isServerStartFailure(
  executor: AgentExecutor,
  error: unknown
): boolean {
  const code =
    executor === "codex"
      ? "codex_server_start_failed"
      : executor === "opencode"
        ? "opencode_server_start_failed"
        : undefined;
  if (!code) {
    return false;
  }
  if (error instanceof Error) {
    return error.message === code;
  }
  return false;
}

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

  const agentfsDbDir = (() => {
    const ctx = spec.context as unknown;
    if (!ctx || typeof ctx !== "object") {
      return;
    }
    const dir = (ctx as { agentfsDbDir?: unknown }).agentfsDbDir;
    if (typeof dir !== "string" || dir.trim().length === 0) {
      return;
    }
    return dir;
  })();

  // Create AgentFS workspace for agent execution
  let workspaceEnv: Workspace | undefined;
  let agentfsDbPath: string | undefined;
  let containerName: string | undefined;
  let containerCw: string | undefined;

  const agentfsDbPathOverride = (() => {
    if (!agentfsDbDir) {
      return;
    }

    const repoBase = path.resolve(workspace);
    const absDir = path.isAbsolute(agentfsDbDir)
      ? path.resolve(agentfsDbDir)
      : path.resolve(repoBase, agentfsDbDir);

    const relDir = path.relative(repoBase, absDir);
    if (relDir.startsWith("..") || path.isAbsolute(relDir)) {
      return;
    }

    const safeRunId = runId.replace(/[^a-zA-Z0-9-]/g, "-");
    const safeAgentId = spec.agentId.replace(/[^a-zA-Z0-9-]/g, "-");
    const absFile = path.join(absDir, safeRunId, `${safeAgentId}.db`);
    return path.relative(repoBase, absFile);
  })();

  const agentfsProjectId = await (async () => {
    if (spec.environment !== "agentfs") {
      return;
    }
    const url = process.env.DATABASE_URL;
    if (!url || url.startsWith("sqlite")) {
      return;
    }

    try {
      const workflowRepo = await import("@alfred/db/repo/workflow");
      const run = await workflowRepo.getRun(runId);
      if (run?.projectId) {
        void import("@alfred/db/repo/project")
          .then((repo) => repo.updateProjectLastActive(run.projectId!))
          .catch(() => {});
        return run.projectId;
      }
    } catch {
      // ignore
    }

    if (userId) {
      try {
        const { detectProject } = await import("@alfred/plan");
        const project = await detectProject(workspace, userId);
        return project.id;
      } catch {
        // ignore
      }
    }

    return;
  })();

  const agentfsContainerNameOverride = agentfsProjectId
    ? `alfred-agentfs-project-${agentfsProjectId.replace(/[^a-zA-Z0-9]/g, "-")}`
    : undefined;

  try {
    workspaceEnv = await WorkspaceFactory.create(
      spec.environment,
      spec.agentId,
      runId,
      workspace,
      {
        agentfsOverlay: spec.agentfsOverlay,
        agentfsDbPath: agentfsDbPathOverride,
        authz,
        containerName: agentfsContainerNameOverride,
        retainContainer: Boolean(agentfsProjectId),
        projectId: agentfsProjectId,
        containerKind: agentfsProjectId ? "agentfs_dev" : undefined,
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

    if (isAgentFSWorkspace(workspaceEnv)) {
      agentfsDbPath = workspaceEnv.dbPath;

      const baseCw =
        typeof (workspaceEnv as unknown as { containerCw?: unknown })
          .containerCw === "string"
          ? (workspaceEnv as unknown as { containerCw: string }).containerCw
          : undefined;
      const baseId =
        typeof (workspaceEnv as unknown as { containerName?: unknown })
          .containerName === "string"
          ? (workspaceEnv as unknown as { containerName: string }).containerName
          : undefined;

      if (baseCw && baseId) {
        // Codex runs inside the AgentFSWorkspace Docker container.
        // docker exec accepts either container name or container id.
        containerName = baseId;

        const rel = path.relative(workspaceEnv.root, spec.workingDirectory);
        const relPosix = rel.split(path.sep).join(path.posix.sep);
        containerCw =
          relPosix && !relPosix.startsWith("..") && relPosix !== "."
            ? path.posix.join(baseCw, relPosix)
            : baseCw;
      }
    }
  } catch (error) {
    logger.warn("workspace_creation_failed", {
      runId,
      agentId: spec.agentId,
      error: error instanceof Error ? error.message : String(error),
    });
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

  const clarifications = ((): Array<{ response: string }> | undefined => {
    const ctx = spec.context as unknown;
    if (!ctx || typeof ctx !== "object") {
      return;
    }
    const raw = (ctx as { clarifications?: unknown }).clarifications;
    if (!Array.isArray(raw)) {
      return;
    }
    const out: Array<{ response: string }> = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const response = (item as { response?: unknown }).response;
      if (typeof response === "string") {
        out.push({ response });
      }
    }
    return out.length > 0 ? out : undefined;
  })();
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
    } as unknown as WorkflowEvent);

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
        agentfsDbPath,
        context: spec.context,
        userId,
      },
      projectConfig,
      workspaceEnv,
      writer
    );
  }

  const startedAt = Date.now();
  const executor = normalizeAgentType(spec.agentType);
  const execProfileExplicit = normalizeExecProfile(spec.profile);
  const profileRaw =
    typeof spec.profile === "string" ? spec.profile.trim() : "";
  const supportsServer = executor === "codex" || executor === "opencode";
  const execProfileStrict =
    process.env.ORCH_EXEC_PROFILE_STRICT?.trim() === "1";
  const execProfile =
    execProfileExplicit ??
    (profileRaw.length === 0 && supportsServer && containerName
      ? "server"
      : undefined);
  const codexCliProfile =
    executor === "codex" && profileRaw.length > 0 && !execProfileExplicit
      ? profileRaw
      : undefined;

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
    if (executor === "codex") {
      const run = (nextProfile: ExecProfile | undefined) =>
        toolCodex.execute({
          input: {
            action: "exec",
            execProfile: nextProfile,
            prompt,
            out: "text",
            auto: spec.auto,
            cw: spec.workingDirectory,
            sessionId: spec.sessionId,
            agentfsDbPath,
            containerName,
            containerCw,
            model: spec.model,
            profile: codexCliProfile,
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

      try {
        await run(execProfile);
      } catch (error) {
        if (
          execProfile === "server" &&
          !execProfileStrict &&
          !signal.aborted &&
          isServerStartFailure("codex", error)
        ) {
          void Promise.resolve(
            writer.write?.({
              type: "notice",
              message: "executor_server_fallback_default",
            })
          ).catch(() => {});
          await run("default");
        } else {
          throw error;
        }
      }
    } else if (executor === "droid") {
      if (execProfile === "server") {
        void Promise.resolve(
          writer.write?.({
            type: "notice",
            message: "droid_server_profile_unsupported",
          })
        ).catch(() => {});
      }
      const { toolDroid } = await import(
        "@alfred/agent/orchestrator/tool/droid"
      );
      await toolDroid.execute({
        input: {
          prompt,
          out: "text",
          auto: spec.auto,
          cw: spec.workingDirectory,
          model: spec.model,
          authz,
        },
        writer,
        signal,
      });
    } else {
      const { toolOpenCode } = await import(
        "@alfred/agent/orchestrator/tool/opencode/index"
      );
      const run = (nextProfile: ExecProfile | undefined) =>
        toolOpenCode.execute({
          input: {
            action: "exec",
            execProfile: nextProfile,
            prompt,
            auto: spec.auto,
            cw: spec.workingDirectory,
            sessionId: spec.sessionId,
            model: spec.model,
            authz,
            containerName,
            containerCw,
          },
          writer,
          signal,
        });

      try {
        await run(execProfile);
      } catch (error) {
        if (
          execProfile === "server" &&
          !execProfileStrict &&
          !signal.aborted &&
          isServerStartFailure("opencode", error)
        ) {
          void Promise.resolve(
            writer.write?.({
              type: "notice",
              message: "executor_server_fallback_default",
            })
          ).catch(() => {});
          await run("default");
        } else {
          throw error;
        }
      }
    }
  } catch (error: unknown) {
    // Abort should propagate as an interruption (not a failure) so upstream waves
    // can terminate promptly and runOrchestrator can guarantee cleanup.
    const isAbort =
      signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");

    if (isAbort) {
      queue.enqueue({
        type: "notice",
        message: `agent_interrupted_abort:${spec.agentId}`,
      } as unknown as WorkflowEvent);

      const interruptedAt = Date.now();
      const interruptedSeconds = Math.max(
        0,
        (interruptedAt - startedAt) / 1000
      );

      return {
        agentId: spec.agentId,
        phaseId,
        stuck: false,
        status: "interrupted",
        durationSeconds: interruptedSeconds,
        role: executor,
      };
    }

    // Handle Supervisor Interrupts
    if (
      executor === "codex" &&
      String(error).includes("codex_exec_interrupted")
    ) {
      logger.warn("agent_interrupted_by_supervisor", {
        agentId: spec.agentId,
        error: String(error),
      });
      queue.enqueue({
        type: "notice",
        message: `agent_interrupted: ${String(error)}`,
      } as unknown as WorkflowEvent);

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
        role: executor,
      };
    }

    // Restore on crash (non-interrupt errors)
    if (executor === "codex") {
      const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
        formatCodexRuntimeError(error);
      queue.enqueue({
        type: "notice",
        message: userMessage,
      } as unknown as WorkflowEvent);
      logger.error("codex_agent_failed", {
        agentId: spec.agentId,
        error: rawMessage,
        code,
        needsElevation,
        limitExceeded,
      });
    } else {
      const message =
        error instanceof Error
          ? error.message
          : `agent_failed:${String(error)}`;
      queue.enqueue({
        type: "notice",
        message: `${executor}_agent_failed:${message}`,
      } as unknown as WorkflowEvent);
      logger.error("agent_failed", {
        agentId: spec.agentId,
        executor,
        error: message,
      });
    }

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
  const agentKey =
    spec.agentId as import("@alfred/agent/orchestrator/multi/spawn").AgentId;
  stuck = detectStuckWithContext(
    trackerContextRef.current,
    agentKey,
    Date.now()
  );
  const trackerAgent = trackerContextRef.current.state.agents[agentKey];
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
    }
  } catch {
    // No escalation file found
  }

  // Extract learning data from AgentFS before cleanup
  if (isAgentFSWorkspace(workspaceEnv)) {
    try {
      const { processForLearning } = await import(
        "@alfred/agent/agentfs/learning-bridge"
      );
      await processForLearning(workspaceEnv.dbPath).catch((e: Error) =>
        logger.warn("agentfs_learning_failed", { err: e.message })
      );
    } catch {
      // Learning extraction is best-effort
    }
  }

  const hints = agentFileHints.get(spec.agentId);
  return {
    agentId: spec.agentId,
    phaseId,
    stuck,
    status,
    durationSeconds,
    role: executor,
    escalation: escalationReason,
    result: {
      summary: `${executor} agent execution`,
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
    write: (chunk: unknown): Promise<void> => {
      if (!chunk || typeof chunk !== "object") {
        return Promise.resolve();
      }
      const payload = chunk as Record<string, unknown>;
      const type = typeof payload.type === "string" ? payload.type : "";

      if (type === "stdout" || type === "stderr") {
        const innerRaw = payload.event;
        const inner =
          innerRaw && typeof innerRaw === "object"
            ? (innerRaw as Record<string, unknown>)
            : null;
        const innerType =
          inner && typeof inner.type === "string" ? inner.type : "";

        if (inner && innerType) {
          const ts =
            typeof inner.timestamp === "number" &&
            Number.isFinite(inner.timestamp)
              ? inner.timestamp
              : Date.now();
          if (innerType === "thought") {
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "codex/thought",
                agentId: spec.agentId,
                text: typeof inner.content === "string" ? inner.content : "",
                ts,
              }
            );
          } else if (innerType === "command") {
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "codex/command",
                agentId: spec.agentId,
                command: typeof inner.command === "string" ? inner.command : "",
                status:
                  inner.status === "failed"
                    ? "failed"
                    : inner.status === "completed"
                      ? "completed"
                      : "running",
                ts,
              }
            );
          } else if (innerType === "artifact") {
            const filePath = typeof inner.path === "string" ? inner.path : "";
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "codex/file",
                agentId: spec.agentId,
                path: filePath,
                kind: typeof inner.kind === "string" ? inner.kind : "file",
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
        } as unknown as WorkflowEvent);
      } else if (type === "notice") {
        const message =
          typeof payload.message === "string"
            ? payload.message
            : "codex_notice";
        queue.enqueue({ type: "notice", message } as unknown as WorkflowEvent);
      }
      return Promise.resolve();
    },
  } as const;
}
