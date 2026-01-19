import * as fs from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as setNodeTimeout } from "node:timers";
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
import {
  type AgentEscalationEvent,
  isAgentEscalationEvent,
} from "@alfred/agent/orchestrator/tool/shared/context";
import { issueMcpSessionToken } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import type { RuntimeMcpServer } from "@alfred/mcp";
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
  runtimeMcp?: {
    server: RuntimeMcpServer;
    url: string;
  };
};

export type AgentOutcome = {
  agentId: string;
  phaseId?: string; // New
  stuck: boolean;
  status: string;
  durationSeconds: number;
  role: string;
  escalation?: string;
  /** Structured escalation data from escalate tool (real-time) */
  escalationData?: AgentEscalationEvent;
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
  runtimeMcp,
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
    const absFile = path.join(absDir, safeRunId, "agentfs.db");
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

  // Track real-time escalation data from escalate tool
  let realTimeEscalationData: AgentEscalationEvent | undefined;

  const writer = createAgentWriter(
    spec,
    trackerContextRef,
    agentFileHints,
    queue,
    (escalationEvent) => {
      // Capture escalation data for outcome
      realTimeEscalationData = escalationEvent;
      logger.info("agent_escalation_callback", {
        agentId: spec.agentId,
        reason: escalationEvent.reason,
        severity: escalationEvent.severity,
      });
    }
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

  // Runtime MCP: deterministic escalation with immediate tool-call receipt.
  // We use an agent-local AbortController so the MCP server can request abort
  // without relying on prompt compliance or post-exit file checks.
  const agentAbortController = new AbortController();
  const parentAbortListener = () => {
    try {
      agentAbortController.abort();
    } catch {
      // ignore
    }
  };
  if (signal.aborted) {
    parentAbortListener();
  } else {
    signal.addEventListener("abort", parentAbortListener, { once: true });
  }
  const agentSignal = agentAbortController.signal;

  type McpEscalationState = {
    input: import("@alfred/mcp").RuntimeMcpEscalationInput;
    receipt: import("@alfred/mcp").RuntimeMcpEscalationReceipt;
  };
  let mcpEscalation: McpEscalationState | undefined;

  const mcpAbortDelayMs = (() => {
    const raw = process.env.ORCH_MCP_ABORT_DELAY_MS?.trim();
    const n = raw ? Number(raw) : 250;
    return Number.isFinite(n) && n >= 0 && n <= 30_000 ? n : 250;
  })();

  const mcpToken = runtimeMcp
    ? await issueMcpSessionToken(userId ?? spec.agentId, ["mcp.escalate"])
    : undefined;

  if (runtimeMcp && mcpToken) {
    runtimeMcp.server.registerSession(
      {
        runId,
        agentId: spec.agentId,
        abort: (reason) => {
          logger.info("runtime_mcp_abort_requested", {
            runId,
            agentId: spec.agentId,
            reason,
          });
          // Delay the abort slightly so the MCP tool call can return its receipt.
          const t = setNodeTimeout(
            () => parentAbortListener(),
            mcpAbortDelayMs
          );
          t.unref();
        },
        onEscalate: (payload) => {
          mcpEscalation = {
            input: payload.input,
            receipt: payload.receipt,
          };
          // Normalize runtime MCP escalations into the canonical escalation event path
          // so pipeline + UI see the same `agent:escalate-request` signal.
          writer.write({
            type: "escalate",
            reason: payload.input.reason as AgentEscalationEvent["reason"],
            details: payload.input.details,
            suggestions: payload.input.suggestions,
            severity: payload.input.severity,
          } satisfies AgentEscalationEvent);
        },
      },
      { token: mcpToken }
    );
  }

  const runtimeMcpUrlForExecutor = (() => {
    const raw = runtimeMcp?.url;
    if (!raw) {
      return;
    }
    const parsed = new URL(raw);
    const hostForContainers =
      process.env.ORCH_MCP_HOST?.trim() || "host.docker.internal";
    const containerExec =
      (executor === "codex" || executor === "opencode") &&
      Boolean(containerName);
    const host = containerExec ? hostForContainers : "127.0.0.1";
    parsed.host = `${host}:${parsed.port}`;
    return parsed.toString();
  })();

  const codexHomeInContainer = `/agentfs/codex-home/${safeAgentId}`;
  const codexHomeOnHost = path.resolve(
    workspace,
    ".agentfs",
    runId.replace(/[^a-zA-Z0-9-]/g, "-"),
    "codex-home",
    safeAgentId
  );
  const codexHomeEnv = containerName ? codexHomeInContainer : codexHomeOnHost;

  if (executor === "codex" && mcpToken && runtimeMcpUrlForExecutor) {
    const configToml = [
      "[mcp_servers.alfred_runtime]",
      `url = "${runtimeMcpUrlForExecutor}"`,
      'bearer_token_env_var = "MCP_AUTH_TOKEN"',
      "startup_timeout_sec = 10",
      "tool_timeout_sec = 30",
      'enabled_tools = ["escalate"]',
      "",
    ].join("\n");
    try {
      await fs.mkdir(codexHomeOnHost, { recursive: true });
      await Bun.write(path.join(codexHomeOnHost, "config.toml"), configToml);
    } catch (error) {
      logger.warn("runtime_mcp_codex_home_write_failed", {
        runId,
        agentId: spec.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
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
    const agentKey =
      spec.agentId as import("@alfred/agent/orchestrator/multi/spawn").AgentId;

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
              env: mcpToken
                ? {
                    CODEX_HOME: codexHomeEnv,
                    MCP_AUTH_TOKEN: mcpToken,
                  }
                : undefined,
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
            signal: agentSignal,
          });

        try {
          await run(execProfile);
        } catch (error) {
          if (
            execProfile === "server" &&
            !execProfileStrict &&
            !agentSignal.aborted &&
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

        const droidHomeOnHost = path.resolve(
          workspace,
          ".agentfs",
          runId.replace(/[^a-zA-Z0-9-]/g, "-"),
          "droid-home",
          safeAgentId
        );

        if (mcpToken && runtimeMcpUrlForExecutor) {
          const mcpJson = {
            mcpServers: {
              alfred_runtime: {
                type: "http",
                url: runtimeMcpUrlForExecutor,
                headers: {
                  authorization: `Bearer ${mcpToken}`,
                },
                disabled: false,
              },
            },
          } as const;
          try {
            await fs.mkdir(path.join(droidHomeOnHost, ".factory"), {
              recursive: true,
            });
            await Bun.write(
              path.join(droidHomeOnHost, ".factory", "mcp.json"),
              JSON.stringify(mcpJson, null, 2)
            );
          } catch (error) {
            logger.warn("runtime_mcp_droid_home_write_failed", {
              runId,
              agentId: spec.agentId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        await toolDroid.execute({
          input: {
            prompt,
            out: "text",
            auto: spec.auto,
            cw: spec.workingDirectory,
            model: spec.model,
            authz,
            env: mcpToken
              ? {
                  HOME: droidHomeOnHost,
                }
              : undefined,
          },
          writer,
          signal: agentSignal,
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
              mcpServers:
                mcpToken && runtimeMcpUrlForExecutor
                  ? [
                      {
                        name: "alfred_runtime",
                        url: runtimeMcpUrlForExecutor,
                        headers: [
                          {
                            name: "authorization",
                            value: `Bearer ${mcpToken}`,
                          },
                        ],
                      },
                    ]
                  : undefined,
            },
            writer,
            signal: agentSignal,
          });

        try {
          await run(execProfile);
        } catch (error) {
          if (
            execProfile === "server" &&
            !execProfileStrict &&
            !agentSignal.aborted &&
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
        agentSignal.aborted ||
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

        const wasBlockingEscalation =
          mcpEscalation?.input.severity === "blocking";
        return {
          agentId: spec.agentId,
          phaseId,
          stuck: false,
          status: wasBlockingEscalation ? "escalated" : "interrupted",
          durationSeconds: interruptedSeconds,
          role: executor,
          escalation:
            wasBlockingEscalation && mcpEscalation
              ? `runtime_mcp_escalate:${mcpEscalation.input.reason}:${mcpEscalation.input.details}`
              : undefined,
          result: {
            summary: wasBlockingEscalation
              ? "agent escalated (runtime mcp)"
              : "agent interrupted (abort)",
            artifacts: [],
            changes: [],
            notes: [],
          },
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
    if (status !== "failed") {
      // Ensure a successful run always marks the agent as completed even if the
      // executor emitted only notices (which create the agent entry but do not
      // advance status).
      trackerContextRef.current = updateTrackerWithContext(
        trackerContextRef.current,
        {
          type: "agent/command",
          agentId: agentKey,
          command: "agent_finished",
          status: "completed",
          ts: finishedAt,
        }
      );
    }

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

    // Check for Escalation (file-based fallback - deprecated)
    // Real-time escalation via escalate tool is preferred
    if (!realTimeEscalationData) {
      try {
        const escalationPath = path.join(spec.workingDirectory, escalationFile);
        const escalationFileObj = Bun.file(escalationPath);
        if (await escalationFileObj.exists()) {
          const escalationContent = await escalationFileObj.text();
          if (escalationContent.trim().length > 0) {
            escalationReason = escalationContent;

            // Log deprecation warning for file-based escalation
            logger.warn("deprecated_file_escalation", {
              runId,
              userId,
              agentId: spec.agentId,
              message:
                "File-based escalation is deprecated. Use the escalate tool for real-time escalation handling.",
            });

            logger.warn("agent_escalated", {
              runId,
              userId,
              agentId: spec.agentId,
              reason: escalationReason,
              source: "file", // Indicate this came from deprecated file mechanism
            });

            if (execPlanAbsolutePath) {
              await appendDecisionEntry(
                execPlanAbsolutePath,
                "Escalated (via deprecated file mechanism)",
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
    }

    // Extract learning data from AgentFS before cleanup
    if (isAgentFSWorkspace(workspaceEnv)) {
      try {
        const { processForLearning } = await import(
          "@alfred/agent/agentfs/learning-bridge"
        );
        await processForLearning(workspaceEnv.dbPath).catch((error: Error) =>
          logger.warn("agentfs_learning_failed", {
            runId,
            userId,
            agentId: spec.agentId,
            error,
          })
        );
      } catch {
        // Learning extraction is best-effort
      }
    }

    const hints = agentFileHints.get(spec.agentId);

    // Prefer runtime MCP escalation (deterministic) over writer/file fallbacks.
    const effectiveEscalation = mcpEscalation
      ? `runtime_mcp_escalate:${mcpEscalation.input.reason}:${mcpEscalation.input.details}`
      : (realTimeEscalationData?.details ?? escalationReason);
    const hasAnyEscalation =
      Boolean(mcpEscalation) ||
      Boolean(realTimeEscalationData) ||
      Boolean(escalationReason);
    const hasBlockingEscalation =
      mcpEscalation?.input.severity === "blocking" ||
      realTimeEscalationData?.severity === "blocking" ||
      Boolean(escalationReason);
    const effectiveStatus = hasBlockingEscalation ? "escalated" : status;

    return {
      agentId: spec.agentId,
      phaseId,
      stuck,
      status: effectiveStatus,
      durationSeconds,
      role: executor,
      escalation: hasAnyEscalation ? effectiveEscalation : undefined,
      escalationData: realTimeEscalationData,
      result: {
        summary: `${executor} agent execution`,
        artifacts: [],
        changes: hints ? Array.from(hints) : [],
        notes: [],
        branch: workspaceEnv?.branch ?? undefined,
      },
    };
  } finally {
    signal.removeEventListener("abort", parentAbortListener);
    if (mcpToken && runtimeMcp) {
      runtimeMcp.server.unregisterToken(mcpToken);
    }
  }
}

function buildAgentPrompt(
  spec: AgentSpec,
  task: SubTask | undefined,
  execPlanPromptPath: string,
  escalationFile: string,
  clarifications?: Array<{ response: string }>
): string {
  const executor = normalizeAgentType(spec.agentType);
  const runtimeEscalateTool =
    executor === "codex" || executor === "droid"
      ? "mcp__alfred_runtime__escalate"
      : executor === "opencode"
        ? "alfred_runtime_escalate"
        : "escalate";

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
    `- If you encounter a blocking issue that requires re-planning, call the runtime MCP tool \`${runtimeEscalateTool}\` with:`,
    "  - reason: one of 'missing_dependency', 'wrong_architecture', 'permission_denied', 'resource_exhausted', 'external_service_unavailable', 'conflicting_requirements', or 'other'",
    "  - details: a clear description of the blocker and what you attempted",
    "  - suggestions: optional list of potential resolutions (max 5)",
    "  - severity: 'blocking' if work cannot continue, 'warning' if it can continue with degraded results",
    "- Wait for the receipt.",
    '  - If `action: "abort"`, stop immediately (the orchestrator is aborting your session).',
    '  - If `action: "continue"`, continue working; the orchestrator will surface your escalation in the UI.',
    `- Fallback (deprecated): if MCP tools are unavailable, write a file named '${escalationFile}' with the reason and exit (treated as blocking).`,
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

/**
 * Escalation callback for real-time escalation handling.
 */
type EscalationCallback = (event: AgentEscalationEvent) => void;

function createAgentWriter(
  spec: AgentSpec,
  trackerContextRef: { current: TrackerContext },
  agentFileHints: Map<string, Set<string>>,
  queue: AsyncQueue<WorkflowEvent>,
  onEscalation?: EscalationCallback
) {
  return {
    write: (chunk: unknown): Promise<void> => {
      if (!chunk || typeof chunk !== "object") {
        return Promise.resolve();
      }
      const payload = chunk as Record<string, unknown>;
      const type = typeof payload.type === "string" ? payload.type : "";

      // Real-time escalation detection - check before other processing
      if (isAgentEscalationEvent(chunk)) {
        logger.warn("agent_escalation_detected", {
          agentId: spec.agentId,
          reason: chunk.reason,
          severity: chunk.severity,
          details: chunk.details.slice(0, 200), // Truncate for logging
        });

        // Emit escalation event to workflow queue
        queue.enqueue({
          type: "agent:escalate-request",
          agentId: spec.agentId,
          reason: chunk.reason,
          details: chunk.details,
          suggestions: chunk.suggestions,
          severity: chunk.severity,
          timestamp: Date.now(),
        } as unknown as WorkflowEvent);

        // Invoke callback for immediate handling (e.g., abort signal)
        onEscalation?.(chunk);

        return Promise.resolve();
      }

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
                type: "agent/thought",
                agentId: spec.agentId,
                text: typeof inner.content === "string" ? inner.content : "",
                ts,
              }
            );
          } else if (innerType === "command") {
            trackerContextRef.current = updateTrackerWithContext(
              trackerContextRef.current,
              {
                type: "agent/command",
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
                type: "agent/file",
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
        trackerContextRef.current = updateTrackerWithContext(
          trackerContextRef.current,
          {
            type: "notice",
            agentId: spec.agentId,
            message,
            ts: Date.now(),
          }
        );
        queue.enqueue({ type: "notice", message } as unknown as WorkflowEvent);
      }
      return Promise.resolve();
    },
  } as const;
}
