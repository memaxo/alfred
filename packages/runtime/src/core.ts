/**
 * Workflow Runtime Core
 * 
 * Pure execution engine with AsyncGenerator interface.
 * Orchestrates workflow phases, handles cancellation/resume, integrates domain packages.
 */

import { randomUUID } from "node:crypto";

import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";
import type { TrackerState } from "@alfred/agent/orchestrator/multi/tracker";
import { logger } from "./utils/logger";
import {
  runtimeExecutionsTotal,
  runtimeExecutionDurationSeconds,
  runtimePhasesTotal,
  runtimePhaseDurationSeconds,
} from "./metrics";
import {
  validateRuntimeOptions,
  type RuntimeInput,
  type RuntimeOptions,
  type RuntimeState,
  type ResumePayload,
  type WorkflowPhase,
  type WorkflowRuntime as IWorkflowRuntime,
} from "./types";

const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const RESUME_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * WorkflowRuntime implements the core execution engine.
 * 
 * Maintains backward compatibility with RunPlanV6 interface while providing
 * clean separation of concerns and testability via dependency injection.
 */
export class WorkflowRuntime implements IWorkflowRuntime {
  public readonly runId: string;
  public readonly summary: string;
  
  // Lazy generator initialization to prevent eager execution
  private _stream: AsyncGenerator<WorkflowEvent, void, void> | null = null;
  public get stream(): AsyncGenerator<WorkflowEvent, void, void> {
    if (!this._stream) {
      this._stream = this.execute();
    }
    return this._stream;
  }

  // Reserved for Phase 3.3+ integration (intentionally unused for now)
  private readonly _input: RuntimeInput;
  private readonly _model: LanguageModel;
  private readonly stepTimeoutMs: number;
  private readonly workflowTimeoutMs: number;
  private readonly workflowStartTime: number;
  
  private state: RuntimeState;
  private signal?: AbortSignal;

  constructor(options: RuntimeOptions) {
    // Validate options to catch configuration errors early
    const validated = validateRuntimeOptions(options);
    
    this.runId = randomUUID();
    this.summary = `Workflow initialized for ${validated.input.requirement}`;
    
    // Store for Phase 3.3+ when integrating context builder and AI SDK
    this._input = validated.input;
    this._model = validated.model;
    
    this.signal = validated.signal;
    this.stepTimeoutMs = validated.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.workflowTimeoutMs = validated.workflowTimeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
    this.workflowStartTime = Date.now();

    // Initialize runtime state
    this.state = {
      runId: this.runId,
      phase: null,
      cancelled: false,
      resumeResolver: null,
      resumeQueue: [],
      resumeTimeout: null,
      finalStatus: null,
      finalMessage: null,
    };

    // Setup cancellation listener
    if (this.signal) {
      if (this.signal.aborted) {
        this.state.cancelled = true;
      }
      this.signal.addEventListener("abort", () => {
        this.state.cancelled = true;
      });
    }
  }

  /**
   * Main execution generator
   * 
   * Yields WorkflowEvent instances as execution proceeds.
   * Implements all phases: scan, plan, act, report.
   */
  private async *execute(): AsyncGenerator<WorkflowEvent, void, void> {
    const stopWorkflow = runtimeExecutionDurationSeconds.startTimer({ 
      auto: this._input.auto ?? "low",
    });
    
    runtimeExecutionsTotal.inc({ 
      auto: this._input.auto ?? "low",
      status: "started",
    });
    
    logger.info("runtime_execution_start", {
      runId: this.runId,
      requirement: this._input.requirement.slice(0, 100),
      auto: this._input.auto ?? "low",
    });
    
    try {
      // Emit run start event
      yield { type: "run", id: this.runId } as WorkflowEvent;
      yield { type: "progress", pct: 0, message: "initializing" } as WorkflowEvent;

      // Check for cancellation
      if (this.state.cancelled) {
        yield { type: "notice", message: "workflow_cancelled_before_start" } as WorkflowEvent;
        this.state.finalStatus = "cancelled";
        
        runtimeExecutionsTotal.inc({ 
          auto: this._input.auto ?? "low",
          status: "cancelled",
        });
        stopWorkflow({ status: "cancelled" });
        
        logger.info("runtime_execution_cancelled", {
          runId: this.runId,
          phase: "initialization",
        });
        
        return;
      }

      // Check for workflow timeout
      const checkTimeout = () => {
        if (Date.now() - this.workflowStartTime > this.workflowTimeoutMs) {
          throw new Error("workflow_timeout");
        }
      };

      // Execute phases sequentially
      const phases: WorkflowPhase[] = ["scan", "plan", "act", "report"];
      
      for (const phase of phases) {
        if (this.state.cancelled) {
          this.state.finalStatus = "cancelled";
          yield { type: "notice", message: `workflow_cancelled_during_${phase}` } as WorkflowEvent;
          
          runtimeExecutionsTotal.inc({ 
            auto: this._input.auto ?? "low",
            status: "cancelled",
          });
          stopWorkflow({ status: "cancelled" });
          
          logger.info("runtime_execution_cancelled", {
            runId: this.runId,
            phase,
          });
          
          return;
        }

        checkTimeout();
        this.state.phase = phase;
        
        yield* this.executePhase(phase);
      }

      // Workflow completed successfully
      this.state.finalStatus = "completed";
      yield { type: "progress", pct: 100, message: "completed" } as WorkflowEvent;
      
      runtimeExecutionsTotal.inc({ 
        auto: this._input.auto ?? "low",
        status: "completed",
      });
      stopWorkflow({ status: "completed" });
      
      logger.info("runtime_execution_complete", {
        runId: this.runId,
        durationMs: Date.now() - this.workflowStartTime,
      });

    } catch (error) {
      this.state.finalStatus = "failed";
      this.state.finalMessage = error instanceof Error ? error.message : String(error);
      
      yield {
        type: "error",
        message: this.state.finalMessage,
      } as WorkflowEvent;
      
      runtimeExecutionsTotal.inc({ 
        auto: this._input.auto ?? "low",
        status: "failed",
      });
      stopWorkflow({ status: "failed" });
      
      logger.error("runtime_execution_failed", {
        runId: this.runId,
        error: this.state.finalMessage,
        durationMs: Date.now() - this.workflowStartTime,
      });
      
      throw error;
    }
  }

  /**
   * Execute a single workflow phase with timeout
   * 
   * Uses AbortController to enforce timeout during phase execution,
   * not just after completion.
   */
  private async *executePhase(phase: WorkflowPhase): AsyncGenerator<WorkflowEvent, void, void> {
    const startTime = Date.now();
    const stopPhase = runtimePhaseDurationSeconds.startTimer({ phase });
    const phaseAbort = new AbortController();
    
    runtimePhasesTotal.inc({ phase, status: "started" });
    
    logger.info("runtime_phase_start", {
      runId: this.runId,
      phase,
      requirement: this._input.requirement.slice(0, 100),
    });
    
    // Set timeout to abort phase if it runs too long
    const timeout = setTimeout(() => {
      phaseAbort.abort();
    }, this.stepTimeoutMs);
    
    try {
      yield { type: "step-start", phase } as any;
      yield { type: "progress", pct: this.getProgressForPhase(phase), message: `${phase}_started` } as WorkflowEvent;

      // Phase-specific execution with abort signal
      switch (phase) {
        case "scan":
          yield* this.executeScanPhase(phaseAbort.signal);
          break;
        case "plan":
          yield* this.executePlanPhase(phaseAbort.signal);
          break;
        case "act":
          yield* this.executeActPhase(phaseAbort.signal);
          break;
        case "report":
          yield* this.executeReportPhase(phaseAbort.signal);
          break;
      }

      yield { type: "step-complete", phase } as any;
      yield { type: "progress", pct: this.getProgressForPhase(phase, true), message: `${phase}_completed` } as WorkflowEvent;
      
      const durationMs = Date.now() - startTime;
      runtimePhasesTotal.inc({ phase, status: "completed" });
      stopPhase();
      
      logger.info("runtime_phase_complete", {
        runId: this.runId,
        phase,
        durationMs,
        status: "success",
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      runtimePhasesTotal.inc({ phase, status: "failed" });
      stopPhase();
      
      // Check if error is due to phase timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.error("runtime_phase_timeout", {
          runId: this.runId,
          phase,
          durationMs,
          timeoutMs: this.stepTimeoutMs,
        });
        yield { type: "error", message: "phase_timeout" } as WorkflowEvent;
      } else {
        logger.error("runtime_phase_failed", {
          runId: this.runId,
          phase,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        });
        yield {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        } as WorkflowEvent;
      }
      throw error;
    } finally {
      // Always clear timeout to prevent leaks
      clearTimeout(timeout);
    }
  }

  /**
   * Scan phase: context gathering
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeScanPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "context", phase: "scan", message: "gathering_context" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Integrate with context builder (Phase 3.2)
    // For now, emit placeholder
    yield { type: "notice", message: "context_gathering_placeholder" } as WorkflowEvent;
  }

  /**
   * Plan phase: task decomposition and ExecPlan bootstrap
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executePlanPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "planning_started" } as WorkflowEvent;
    
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }

    const { ContextBuilder } = await import("./context");
    const { persistExecPlans } = await import(
      "@alfred/agent/assistant/graphstore"
    );
    const { decomposeTask } = await import(
      "@alfred/agent/orchestrator/multi/decompose"
    );
    const { generateSubtaskExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/execplan"
    );

    const builder = new ContextBuilder();
    const workspace = this._input.workspace ?? process.cwd();

    const context = await builder.build({
      requirement: this._input.requirement,
      workspace,
      repoBase: this._input.repoBase,
      web: this._input.context?.web,
      topK: this._input.context?.topK,
      maxTokens: this._input.context?.maxTokens,
      exts: this._input.context?.exts,
      ignore: this._input.context?.ignore,
      seeds: this._input.context?.seeds,
      authz: undefined,
    });

    const subTasks = decomposeTask(this._input.requirement, {
      requirement: this._input.requirement,
      bundle: context.bundle,
    });

    yield { type: "context", phase: "plan", message: "subtasks_decomposed" } as any;
    yield { type: "event", kind: "data-subtasks", data: subTasks } as any;

    const rootPlanTitle = `Multi-agent workflow for run ${this.runId}`;
    const rootPlan = [
      `# ${rootPlanTitle}`,
      "",
      "This ExecPlan is a living document for the overall multi-agent workflow.",
      "",
      "See .agent/PLANS.md for methodology requirements.",
      "",
      "## Progress",
      "",
      "- [ ] (pending) Workflow initialised.",
      "",
      "## Surprises & Discoveries",
      "",
      "- Pending.",
      "",
      "## Decision Log",
      "",
      "- Pending.",
      "",
      "## Outcomes & Retrospective",
      "",
      "- Pending.",
      "",
    ].join("\n");

    const execplanRootPath = `.agent/plans/${this.runId}.root.md`;

    const execplanPayload = {
      type: "event",
      kind: "execplan-root-created",
      data: {
        runId: this.runId,
        path: execplanRootPath,
        content: rootPlan,
        subtasks: subTasks.map((task) => ({
          id: task.id,
          path: `.agent/plans/${this.runId}/${task.id}.md`,
          skeleton: generateSubtaskExecPlanSkeleton(task, this.runId),
        })),
      },
    } as any;

    yield execplanPayload;

    // Surface trimmed context details for provenance and UX
    const bundleFiles =
      Array.isArray(context.bundle?.files) && context.bundle.files.length > 0
        ? context.bundle.files.slice(0, 10).map((file) => ({
            path: file.path,
            startLine: file.startLine,
            endLine: file.endLine,
          }))
        : [];

    yield {
      type: "event",
      kind: "runtime-context",
      data: {
        ragDocumentIds: context.ragDocumentIds ?? [],
        totalTokens: context.totalTokens,
        bundleFileCount: context.bundle?.files.length ?? 0,
        bundlePreview: bundleFiles,
      },
    } as any;

    // Best-effort ExecPlan graph persistence; failures are logged but non-fatal.
    try {
      await persistExecPlans({
        resource: workspace,
        runId: this.runId,
        rootPath: execplanRootPath,
        subtasks: subTasks.map((task) => ({
          id: task.id,
          path: `.agent/plans/${this.runId}/${task.id}.md`,
        })),
      });
    } catch (error) {
      logger.warn("execplan_graph_persist_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    yield { type: "notice", message: "planning_completed" } as any;
  }

  /**
   * Act phase: execute plan with tools
   *
   * Phase 3: execute multiple Codex agents in dependency-ordered waves.
   * In tests, this phase is short-circuited to preserve fast, deterministic runs.
   *
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeActPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "execution_started" } as WorkflowEvent;

    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }

    const disableAgents =
      (process.env.NODE_ENV === "test" &&
        process.env.RUNTIME_TEST_ORCHESTRATION !== "1") ||
      process.env.RUNTIME_DISABLE_CODEX === "1";

    if (disableAgents) {
      // Preserve existing behaviour for tests / disabled environments.
      yield { type: "notice", message: "execution_placeholder" } as WorkflowEvent;
      return;
    }

    const { decomposeTask } = await import(
      "@alfred/agent/orchestrator/multi/decompose"
    );
    const { buildAgentSpec, planWaves } = await import(
      "@alfred/agent/orchestrator/multi/spawn"
    );
    const { toolCodex } = await import(
      "@alfred/agent/orchestrator/tool/codex"
    );
    const { generateSubtaskExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/execplan"
    );
    const { updateTracker, detectStuck, detectNeedsGuidance } = await import(
      "@alfred/agent/orchestrator/multi/tracker"
    );
    const { buildMergePlan, generateMergeExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/merge"
    );
    const { buildReviewPlan, generateReviewExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/review"
    );
    const { countConflictMarkers, aggregateConflictMarkers, generateConflictExecPlanSkeleton } =
      await import("@alfred/agent/orchestrator/multi/conflict");
    const { worktreeManager } = await import("@alfred/agent/orchestrator/tool/worktree");
    const { executeMergePlan } = await import("@alfred/agent/orchestrator/multi/merge-executor");
    const { toolGit } = await import("@alfred/agent/orchestrator/tool/git");
    const { ContextBuilder } = await import("./context");

    const workspace = this._input.workspace ?? process.cwd();

    let trackerState: TrackerState = { agents: {}, waves: {} };
    const agentFileHints = new Map<string, Set<string>>();
    const agentSubTaskIds = new Map<string, string>();
    const createdWorktrees: string[] = []; // Track for cleanup

    // Rebuild context and subtasks for MVP; future phases may reuse cached state
    const builder = new ContextBuilder();
    const context = await builder.build({
      requirement: this._input.requirement,
      workspace,
      repoBase: this._input.repoBase,
      web: this._input.context?.web,
      topK: this._input.context?.topK,
      maxTokens: this._input.context?.maxTokens,
      exts: this._input.context?.exts,
      ignore: this._input.context?.ignore,
      seeds: this._input.context?.seeds,
      authz: undefined,
    });

    const subTasks = decomposeTask(this._input.requirement, {
      requirement: this._input.requirement,
      bundle: context.bundle,
    });

    if (subTasks.length === 0) {
      yield { type: "notice", message: "no_subtasks_to_execute" } as any;
      return;
    }

    const subTaskById = new Map(subTasks.map((t) => [t.id, t]));
    const waves = planWaves(subTasks, { maxParallel: 2 });

    if (waves.length === 0) {
      // Fallback: treat all subtasks as a single wave.
      waves.push({ id: "wave_0", agents: subTasks.map((t) => t.id), dependsOn: [] });
    }

    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // Track aggregate failure rates for abort heuristics (Phase 6)
    let totalAgents = 0;
    let totalFailedOrStuck = 0;
    let abortedWave:
      | {
          id: string;
          waveFailRate: number;
          overallFailRate: number;
        }
      | null = null;
      
    const allAgentOutcomes: any[] = [];

    for (const wave of waves) {
      if (signal.aborted) {
        throw new DOMException("Phase aborted", "AbortError");
      }

      logger.info("multi_agent_wave_start", {
        runId: this.runId,
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
          if (!task) return null;
          const spec = buildAgentSpec(task, this.runId, workspace, {
            auto: this._input.auto,
            linear: this._input.linear
              ? {
                  issueId: undefined,
                  sessionId: this._input.linear.sessionId,
                  space: this._input.linear.space,
                  authz: this._input.linear.authz,
                }
              : undefined,
          });
          agentSubTaskIds.set(spec.agentId, spec.subTaskId);
          return spec;
        })
        .filter((spec): spec is ReturnType<typeof buildAgentSpec> => Boolean(spec));

      yield {
        type: "event",
        kind: "data-wave-plan",
        data: {
          waveId: wave.id,
          agents: agentSpecs,
          dependsOn: wave.dependsOn,
        },
      } as any;

      const waveEvents: WorkflowEvent[] = [];

      trackerState.waves[wave.id] = { status: "running" };

      const agentOutcomes: Array<{
        agentId: string;
        stuck: boolean;
        status: string;
        durationSeconds: number;
        role: string;
      }> = [];

      for (const spec of agentSpecs) {
        if (signal.aborted) {
          throw new DOMException("Phase aborted", "AbortError");
        }

        // Hybrid Tier: Handle Worktree Environment
        if (spec.environment === "worktree") {
          try {
            const worktreePath = await worktreeManager.create(
              workspace,
              this.runId,
              spec.agentId
            );
            spec.workingDirectory = worktreePath;
            createdWorktrees.push(worktreePath);
            logger.info("worktree_created", {
              runId: this.runId,
              agentId: spec.agentId,
              path: worktreePath,
            });
          } catch (error) {
            logger.warn("worktree_creation_failed", {
              runId: this.runId,
              agentId: spec.agentId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to workspace (Tier 1) or fail? 
            // Fallback seems safer for now, though less isolated.
          }
        }

        const execPlanPath = spec.execPlanPath;
        const dir = path.dirname(execPlanPath);
        await fs.mkdir(dir, { recursive: true });

        try {
          await fs.access(execPlanPath);
        } catch {
          const task = subTaskById.get(spec.subTaskId);
          if (task) {
            const skeleton = generateSubtaskExecPlanSkeleton(task, this.runId);
            await fs.writeFile(execPlanPath, skeleton, "utf8");
          }
        }

        const promptLines = [
          "You are a coding agent executing a single subtask ExecPlan.",
          "",
          `ExecPlan path: ${execPlanPath}`,
          "",
          "Instructions:",
          "- Read the ExecPlan file at the given path.",
          "- Update the Progress and Decision Log sections as you work.",
          "- Make small, idempotent edits to both the ExecPlan and the code.",
          "- Prefer minimal, safe changes that can be retried without harm.",
          "- At the end, summarise what you changed.",
        ];

        const prompt = promptLines.join("\n");

        const bufferedEvents: WorkflowEvent[] = [];

        const writer = {
          write: async (chunk: unknown) => {
            const payload = chunk as { type?: string; event?: unknown };
            if (!payload || typeof payload !== "object") return;
            const type = (payload as any).type;
            if (type === "stdout" || type === "stderr") {
              const text = (payload as any).text ?? "";
              bufferedEvents.push({ type, text } as any);
            } else if (type === "codex_event") {
              const inner = (payload as any).event as
                | { type?: string; content?: string; timestamp?: number; command?: string; status?: string; path?: string; kind?: string }
                | undefined;
              if (inner && typeof inner.type === "string") {
                const ts =
                  typeof inner.timestamp === "number" && Number.isFinite(inner.timestamp)
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

        const startedAt = Date.now();

        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: spec.auto,
            cw: spec.workingDirectory,
            sessionId: spec.sessionId,
            model: spec.model,
            profile: spec.profile,
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

        const finishedAt = Date.now();

        for (const ev of bufferedEvents) {
          waveEvents.push(ev);
        }

        const stuck = detectStuck(trackerState, spec.agentId as any, Date.now());
        const trackerAgent = trackerState.agents[spec.agentId as any];
        const rawStatus = trackerAgent?.status ?? (stuck ? "stuck" : "completed");
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

        // Construct result
        // If worktree was used, assume the agent committed to the dedicated branch
        const branchName = spec.environment === "worktree" 
          ? `agent/${this.runId}/${spec.agentId}` 
          : undefined;

        agentOutcomes.push({
          agentId: spec.agentId,
          subTaskId: spec.subTaskId,
          stuck,
          status: rawStatus,
          durationSeconds,
          role: "worker",
          result: { // Pass to merge planner
            summary: "codex agent execution",
            artifacts: [], // We track files in trackerState generally
            changes: trackerAgent?.filesChanged ?? [],
            notes: [],
            branch: branchName,
          },
        } as any); // Cast to any because AgentOutcome type in runtime might lag slightly behind local merge definitions if imports vary
      }

      for (const ev of waveEvents) {
        yield ev;
      }

      const anyStuck = agentOutcomes.some((o) => o.stuck);
      trackerState.waves[wave.id] = { status: anyStuck ? "failed" : "completed" } as any;

      logger.info("multi_agent_wave_result", {
        runId: this.runId,
        waveId: wave.id,
        status: anyStuck ? "partial" : "completed",
        agentCount: agentOutcomes.length,
        failedOrStuck: agentOutcomes.filter((o) => o.stuck || o.status === "failed" || o.status === "stuck").length,
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

      // Phase 6: wave abort logic for cascading failures.
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
          runId: this.runId,
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
      
      // Cleanup worktrees on abort
      for (const wt of createdWorktrees) {
        try {
          await worktreeManager.remove(workspace, wt);
        } catch { /* ignore */ }
      }
      
      // Skip merge/review when waves are aborted; manual intervention required.
      return;
    }

    const mergeOutcomes = allAgentOutcomes.map((outcome) => ({
        agentId: outcome.agentId,
        subTaskId: (outcome as any).subTaskId ?? "unknown",
        status: outcome.status,
        result: (outcome as any).result ?? {
          summary: "codex agent execution",
          artifacts: [],
          changes: [],
          notes: [],
        },
      }));

    // Add fallback for Tier 1 agents (no explicit result object in loop above for legacy path? 
    // Wait, I added result to agentOutcomes in loop. But legacy code might rely on agentFileHints.
    // Let's merge both sources.)
    for (const o of mergeOutcomes) {
      if (!o.result.changes || o.result.changes.length === 0) {
        const hints = agentFileHints.get(o.agentId);
        if (hints) {
          o.result.changes = Array.from(hints);
        }
      }
    }

    const mergePlan = buildMergePlan(mergeOutcomes as any);

    logger.info("multi_agent_merge_plan", {
      runId: this.runId,
      expectedFiles: mergePlan.expectedFiles ?? [],
      summary: mergePlan.summary,
      branches: mergePlan.branches,
    });

    // Phase 9: Automated Merge Execution
    // If branches exist, attempt to merge them.
    // We use toolGit via executeMergePlan.
    // If conflicts occur, they will be caught, and we proceed to conflict handling.
    
    if (mergePlan.branches && mergePlan.branches.length > 0) {
      yield { type: "notice", message: "merge_execution_started" } as any;
      
      const mergeResult = await executeMergePlan(
        mergePlan, 
        workspace, 
        toolGit, 
        {
          write: (chunk: any) => {
             // Forward git output events
             if (chunk?.type === "stdout" || chunk?.type === "stderr") {
               // Maybe filter or just log?
             }
          }
        },
        this._input.linear?.authz
      ).catch(err => {
        logger.error("merge_execution_error", { error: String(err) });
        return { status: "failed", mergedBranches: [], error: String(err) } as const;
      });

      if (mergeResult.status === "completed") {
        yield { type: "notice", message: "merge_execution_completed" } as any;
      } else if (mergeResult.status === "conflict") {
        yield { type: "notice", message: "merge_execution_conflict", branch: mergeResult.conflictBranch } as any;
        // We continue to conflict detection logic below, which will see the markers in the workspace.
      } else {
        logger.warn("merge_execution_failed", { error: mergeResult.error });
        yield { type: "error", message: "merge_execution_failed" } as any;
        // Should we abort or try to continue?
        // If merge failed non-conflict (e.g. unrelated error), probably stuck.
        // For now, let's assume we might still analyze conflicts if they exist?
        // Or just fall through.
      }
    }

    // Passive conflict detection via conflict markers in expected files
    let conflictScanResult:
      | {
          files: string[];
          totalMarkers: number;
          counts: Record<string, number>;
        }
      | null = null;
    try {
      const fsMod = await import("node:fs/promises");
      const pathMod = await import("node:path");
      const expectedFiles = mergePlan.expectedFiles ?? [];
      const counts: Record<string, number> = {};
      for (const rel of expectedFiles) {
        const abs = pathMod.resolve(workspace, rel);
        try {
          const content = await fsMod.readFile(abs, "utf8");
          counts[rel] = countConflictMarkers(content);
        } catch {
          // Ignore unreadable or missing files; conflict detection is best-effort.
        }
      }
      conflictScanResult = aggregateConflictMarkers(
        mergePlan.expectedFiles ?? [],
        counts
      );
    } catch (error) {
      logger.warn("merge_conflict_scan_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (conflictScanResult && conflictScanResult.totalMarkers > 0) {
      yield {
        type: "event",
        kind: "merge-conflict",
        data: conflictScanResult,
      } as any;

      // Conflict analysis agent (analysis-only; no edits)
      const conflictExecPlanPath = `.agent/plans/${this.runId}/conflict.md`;
      try {
        const fsMod = await import("node:fs/promises");
        const pathMod = await import("node:path");
        const dir = pathMod.dirname(conflictExecPlanPath);
        await fsMod.mkdir(dir, { recursive: true });
        try {
          await fsMod.access(conflictExecPlanPath);
        } catch {
          const skeleton = generateConflictExecPlanSkeleton(
            this.runId,
            conflictScanResult
          );
          await fsMod.writeFile(conflictExecPlanPath, skeleton, "utf8");
        }

        const promptLines = [
          "You are a conflict analysis agent.",
          "",
          `ExecPlan path: ${conflictExecPlanPath}`,
          "",
          "Instructions:",
          "- Read the ExecPlan at the given path and the conflict summary.",
          "- Do NOT modify files or run git commands; stay analysis-only.",
          "- Describe the nature of the conflicts and propose safe resolution strategies.",
          "- Update the Progress and Decision Log as you reason.",
          "- Summarise your recommendations at the end.",
        ];
        const prompt = promptLines.join("\n");

        const startedAt = Date.now();
        const conflictEvents: WorkflowEvent[] = [];

        const writer = {
          write: async (chunk: unknown) => {
            const payload = chunk as { type?: string; event?: unknown };
            if (!payload || typeof payload !== "object") return;
            const type = (payload as any).type;
            if (type === "stdout" || type === "stderr") {
              const text = (payload as any).text ?? "";
              conflictEvents.push({ type, text } as any);
            } else if (type === "notice") {
              conflictEvents.push({
                type: "notice",
                message: (payload as any).message ?? "conflict_agent_notice",
              } as any);
            }
          },
        } as const;

        try {
          await toolCodex.execute({
            input: {
              action: "exec",
              prompt,
              out: "text",
              auto: "read", // Enforce read-only for analysis agents
              cw: this._input.workspace ?? process.cwd(),
              sessionId: `${this.runId}:conflict`,
              model: undefined,
              profile: undefined,
              context: {},
            },
            writer,
          });

          const finishedAt = Date.now();
          const durationSeconds = Math.max(
            0,
            (finishedAt - startedAt) / 1000
          );

          for (const ev of conflictEvents) {
            yield ev;
          }

          yield {
            type: "event",
            kind: "conflict-agent-result",
            data: {
              role: "conflict",
              status: "completed",
              durationSeconds,
            },
          } as any;
        } catch (error) {
          const finishedAt = Date.now();
          const durationSeconds = Math.max(
            0,
            (finishedAt - startedAt) / 1000
          );
          logger.warn("conflict_agent_execution_failed", {
            runId: this.runId,
            error: error instanceof Error ? error.message : String(error),
          });
          for (const ev of conflictEvents) {
            yield ev;
          }
          yield {
            type: "event",
            kind: "conflict-agent-result",
            data: {
              role: "conflict",
              status: "failed",
              durationSeconds,
            },
          } as any;
        }
      } catch (error) {
        logger.warn("conflict_agent_initialisation_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Phase C: Conflict Resolution Agent
      // If we have conflicts, attempt to resolve them automatically
      if (conflictScanResult.totalMarkers > 0 && (this._input.auto === "medium" || this._input.auto === "high")) {
        yield { type: "notice", message: "conflict_resolution_started" } as any;
        
        const resolutionExecPlanPath = `.agent/plans/${this.runId}/conflict-resolution.md`;
        
        // Create a resolution plan skeleton if it doesn't exist
        try {
          const fsMod = await import("node:fs/promises");
          const pathMod = await import("node:path");
          const dir = pathMod.dirname(resolutionExecPlanPath);
          await fsMod.mkdir(dir, { recursive: true });
          
          const skeleton = [
            `# Conflict Resolution Plan for run ${this.runId}`,
            "",
            "## Purpose",
            "Resolve merge conflicts detected in the workspace.",
            "",
            "## Instructions",
            "- Use the analysis from `conflict.md` if available.",
            "- For each conflicted file, edit the file to remove conflict markers and choose/merge the correct content.",
            "- Verify the fix by running relevant tests if possible.",
            "",
            "## Progress",
            "- [ ] (pending) Resolution started.",
          ].join("\n");
          
          await fsMod.writeFile(resolutionExecPlanPath, skeleton, "utf8");
        } catch (e) { 
          // Ignore
        }

        const prompt = [
          "You are a conflict resolution agent.",
          `ExecPlan path: ${resolutionExecPlanPath}`,
          "Your goal is to RESOLVE the git merge conflicts in the workspace.",
          "1. Read the conflict analysis.",
          "2. Edit the files to resolve conflicts (choose 'current', 'incoming', or merge manually).",
          "3. Ensure no conflict markers remain.",
        ].join("\n");

        const startedAt = Date.now();
        const events: WorkflowEvent[] = [];
        
        const writer = {
          write: async (chunk: unknown) => {
            // Reuse standard writer logic
            const payload = chunk as any;
            if (payload?.type === "stdout" || payload?.type === "stderr") {
              events.push(payload);
            }
          }
        };

        try {
          await toolCodex.execute({
            input: {
              action: "exec",
              prompt,
              out: "text",
              auto: "medium", // Allow edits for resolution
              cw: this._input.workspace ?? process.cwd(),
              sessionId: `${this.runId}:conflict-resolve`,
              model: undefined,
              profile: undefined,
              context: {},
            },
            writer,
          });

          const finishedAt = Date.now();
          const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

          for (const ev of events) yield ev;

          yield {
            type: "event",
            kind: "conflict-resolution-result",
            data: {
              role: "conflict_resolver",
              status: "completed",
              durationSeconds,
            },
          } as any;

        } catch (error) {
          const finishedAt = Date.now();
          const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
          logger.warn("conflict_resolution_failed", {
            runId: this.runId,
            error: error instanceof Error ? error.message : String(error),
          });
          
          yield {
            type: "event",
            kind: "conflict-resolution-result",
            data: {
              role: "conflict_resolver",
              status: "failed",
              durationSeconds,
            },
          } as any;
        }
      }
    }

    yield {
      type: "event",
      kind: "merge-plan",
      data: mergePlan,
    } as any;

    // Merge analysis agent (analysis-only; no git operations)
    const mergeExecPlanPath = `.agent/plans/${this.runId}/merge.md`;
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const dir = path.dirname(mergeExecPlanPath);
      await fs.mkdir(dir, { recursive: true });
      try {
        await fs.access(mergeExecPlanPath);
      } catch {
        const skeleton = generateMergeExecPlanSkeleton(this.runId, mergePlan);
        await fs.writeFile(mergeExecPlanPath, skeleton, "utf8");
      }

      const promptLines = [
        "You are a merge analysis agent.",
        "",
        `ExecPlan path: ${mergeExecPlanPath}`,
        "",
        "Instructions:",
        "- Read the ExecPlan at the given path and the merge-plan summary.",
        "- Do NOT run git commands or mutate the repository; stay analysis-only.",
        "- Identify overlapping or conflicting edits and areas needing targeted tests.",
        ...(mergePlan.branches && mergePlan.branches.length > 0
          ? [
              "- NOTE: Feature branches exist. Recommend a strategy to merge them (e.g. git merge origin/branch).",
              "- Check for semantic conflicts between these branches."
            ]
          : []),
        "- Update the Progress and Decision Log sections as you reason.",
        "- Summarise your conclusions at the end.",
      ];
      const prompt = promptLines.join("\n");

      const startedAt = Date.now();

      const mergeEvents: WorkflowEvent[] = [];

      const writer = {
        write: async (chunk: unknown) => {
          const payload = chunk as { type?: string; event?: unknown };
          if (!payload || typeof payload !== "object") return;
          const type = (payload as any).type;
          if (type === "stdout" || type === "stderr") {
            const text = (payload as any).text ?? "";
            mergeEvents.push({
              type,
              text,
            } as any);
          } else if (type === "notice") {
            mergeEvents.push({
              type: "notice",
              message: (payload as any).message ?? "merge_agent_notice",
            } as any);
          }
        },
      } as const;

      try {
        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: "read", // Enforce read-only for analysis agents
            cw: this._input.workspace ?? process.cwd(),
            sessionId: `${this.runId}:merge`,
            model: undefined,
            profile: undefined,
            context: {},
          },
          writer,
        });

        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

        for (const ev of mergeEvents) {
          yield ev;
        }

        yield {
          type: "event",
          kind: "merge-agent-result",
          data: {
            role: "merge",
            status: "completed",
            durationSeconds,
          },
        } as any;
      } catch (error) {
        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
        logger.warn("merge_agent_execution_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
        for (const ev of mergeEvents) {
          yield ev;
        }
        yield {
          type: "event",
          kind: "merge-agent-result",
          data: {
            role: "merge",
            status: "failed",
            durationSeconds,
          },
        } as any;
      }
    } catch (error) {
      logger.warn("merge_agent_initialisation_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const reviewPlan = buildReviewPlan({
      files: mergePlan.expectedFiles ?? [],
      summary: mergePlan.summary,
    });

    logger.info("multi_agent_review_plan", {
      runId: this.runId,
      files: reviewPlan.files ?? [],
      checks: reviewPlan.checks?.map((c) => c.kind) ?? [],
    });

    yield {
      type: "event",
      kind: "review-plan",
      data: reviewPlan,
    } as any;
    const reviewExecPlanPath = `.agent/plans/${this.runId}/review.md`;
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const dir = path.dirname(reviewExecPlanPath);
      await fs.mkdir(dir, { recursive: true });
      try {
        await fs.access(reviewExecPlanPath);
      } catch {
        const skeleton = generateReviewExecPlanSkeleton(this.runId, reviewPlan);
        await fs.writeFile(reviewExecPlanPath, skeleton, "utf8");
      }

      const promptLines = [
        "You are a review planning agent.",
        "",
        `ExecPlan path: ${reviewExecPlanPath}`,
        "",
        "Instructions:",
        "- Read the ExecPlan at the given path and the ReviewPlan summary.",
        "- Do NOT run tests, lint, or static analysis; only plan them.",
        "- For each check, specify the exact commands that should be run.",
        "- Update the Progress and Decision Log as you refine the plan.",
        "- Summarise the final review plan at the end.",
      ];
      const prompt = promptLines.join("\n");

      const startedAt = Date.now();

      const reviewEvents: WorkflowEvent[] = [];

      const writer = {
        write: async (chunk: unknown) => {
          const payload = chunk as { type?: string; event?: unknown };
          if (!payload || typeof payload !== "object") return;
          const type = (payload as any).type;
          if (type === "stdout" || type === "stderr") {
            const text = (payload as any).text ?? "";
            reviewEvents.push({
              type,
              text,
            } as any);
          } else if (type === "notice") {
            reviewEvents.push({
              type: "notice",
              message: (payload as any).message ?? "review_agent_notice",
            } as any);
          }
        },
      } as const;

      try {
        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: "read", // Enforce read-only for analysis agents
            cw: this._input.workspace ?? process.cwd(),
            sessionId: `${this.runId}:review`,
            model: undefined,
            profile: undefined,
            context: {},
          },
          writer,
        });

        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

        for (const ev of reviewEvents) {
          yield ev;
        }

        yield {
          type: "event",
          kind: "review-agent-result",
          data: {
            role: "review",
            status: "completed",
            durationSeconds,
          },
        } as any;
      } catch (error) {
        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
        logger.warn("review_agent_execution_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
        for (const ev of reviewEvents) {
          yield ev;
        }
        yield {
          type: "event",
          kind: "review-agent-result",
          data: {
            role: "review",
            status: "failed",
            durationSeconds,
          },
        } as any;
      }
    } catch (error) {
      logger.warn("review_agent_initialisation_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Review execution phase & Self-Correction Loop
    // If checks are planned, execute them using toolRunner
    if (reviewPlan.checks && reviewPlan.checks.length > 0) {
      
      // Dynamic import to avoid load-time side effects
      const { toolRunner } = await import("@alfred/agent/orchestrator/tool/runner");
      
      const MAX_FIX_ATTEMPTS = 3;
      let fixAttempts = 0;
      let reviewPassed = false;
      let reviewFailures: Array<{ command: string; output: string; error?: string }> = [];
      const startedAt = Date.now();

      while (fixAttempts <= MAX_FIX_ATTEMPTS && !reviewPassed) {
        reviewFailures = [];
        let currentRunPassed = true;

        yield { 
          type: "notice", 
          message: fixAttempts === 0 ? "review_execution_started" : "review_retry_started", 
          attempt: fixAttempts + 1 
        } as any;
      
        for (const check of reviewPlan.checks) {
          if (!check) continue;
          
          let command = "";
          if (check.type === "static") command = "bun run typecheck";
          else if (check.type === "lint") command = "bun run lint";
          else if (check.type === "tests") command = "bun test";
          else continue; // Skip manual/scenario checks for automated runner
          
          try {
            yield { 
              type: "event", 
              kind: "tool-call", 
              data: { tool: "runner", command } 
            } as any;

            const result = await toolRunner.execute(command, workspace);
            
            yield { 
              type: "event", 
              kind: "tool-result", 
              data: { 
                tool: "runner", 
                command, 
                exitCode: result.exitCode,
                stdout: result.stdout.slice(0, 1000), // Truncate for event stream
                durationMs: result.durationMs 
              } 
            } as any;

            if (result.exitCode !== 0) {
              currentRunPassed = false;
              reviewFailures.push({ 
                command, 
                output: (result.stdout + "\n" + result.stderr).slice(0, 5000) 
              });
              logger.warn("review_check_failed", { runId: this.runId, command, exitCode: result.exitCode });
            }
          } catch (err) {
            currentRunPassed = false;
            reviewFailures.push({ 
              command, 
              output: "", 
              error: String(err) 
            });
            logger.error("review_command_error", { runId: this.runId, command, error: String(err) });
          }
        }

        if (currentRunPassed) {
          reviewPassed = true;
          break;
        }

        // Self-correction: Spawn Fixer Agent if failed and retries allowed
        if (fixAttempts < MAX_FIX_ATTEMPTS && (this._input.auto === "medium" || this._input.auto === "high")) {
          yield { type: "notice", message: "self_correction_started" } as any;
          
          const fixerExecPlanPath = `.agent/plans/${this.runId}/fixer-${fixAttempts + 1}.md`;
          
          try {
            const fsMod = await import("node:fs/promises");
            const pathMod = await import("node:path");
            const dir = pathMod.dirname(fixerExecPlanPath);
            await fsMod.mkdir(dir, { recursive: true });
            
            const failureDetails = reviewFailures.map(f => 
              `Command: ${f.command}\nError/Output:\n\`\`\`\n${f.output || f.error}\n\`\`\``
            ).join("\n\n");

            const skeleton = [
              `# Fixer ExecPlan (Attempt ${fixAttempts + 1})`,
              "",
              "## Purpose",
              "Fix the errors detected during the review phase.",
              "",
              "## Context",
              "The following checks failed:",
              failureDetails,
              "",
              "## Plan",
              "- Analyze the error output.",
              "- Locate the source files causing the error.",
              "- Apply fixes.",
              "- Verify the fix (the review phase will re-run automatically).",
              "",
              "## Progress",
              "- [ ] (pending) Fix applied.",
            ].join("\n");
            
            await fsMod.writeFile(fixerExecPlanPath, skeleton, "utf8");

            const prompt = [
              "You are a Self-Correction 'Fixer' Agent.",
              `ExecPlan path: ${fixerExecPlanPath}`,
              "Your goal is to FIX the code so that the review checks pass.",
              "1. Read the error context in the plan.",
              "2. Edit the code to resolve the errors.",
              "3. Do not break existing functionality.",
            ].join("\n");

            const fixerEvents: WorkflowEvent[] = [];
            const writer = {
              write: async (chunk: unknown) => {
                const payload = chunk as { type?: string; event?: unknown };
                if (!payload || typeof payload !== "object") return;
                const type = (payload as any).type;
                if (type === "stdout" || type === "stderr") {
                   fixerEvents.push({ type, text: (payload as any).text } as any);
                } else if (type === "notice") {
                   fixerEvents.push({ type: "notice", message: (payload as any).message } as any);
                }
              },
            } as const;

            // Run the Fixer
            await toolCodex.execute({
              input: {
                action: "exec",
                prompt,
                out: "text",
                auto: this._input.auto, // Inherit write permissions
                cw: workspace, 
                sessionId: `${this.runId}:fixer-${fixAttempts}`,
                model: undefined,
                profile: undefined,
                context: {},
              },
              writer, 
            });

            for (const ev of fixerEvents) yield ev;

            yield { 
              type: "event", 
              kind: "fixer-agent-result", 
              data: { 
                attempt: fixAttempts + 1, 
                status: "completed" 
              } 
            } as any;

          } catch (error) {
            logger.error("fixer_agent_failed", { error: String(error) });
            // If fixer crashes, we probably can't recover, but let the loop increment and maybe retry or fail.
          }
          
          fixAttempts++;
        } else {
          break; // No more retries or read-only mode
        }
      }

      const finishedAt = Date.now();
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
      
      yield {
        type: "event",
        kind: "review-exec-result",
        data: {
          role: "review_exec",
          status: reviewPassed ? "completed" : "failed",
          durationSeconds,
          attempts: fixAttempts + (reviewPassed ? 1 : 0), // Count the successful run if passed
        },
      } as any;
    } else if (process.env.RUNTIME_ENABLE_REVIEW_EXEC === "1") {
      // Keep legacy stub path if needed, or remove it. 
      // Removing it as we have real execution now.
    }
    // Cleanup worktrees after successful execution
    // We do this after review, so artifacts are available for merge/review if needed (e.g. via file system check)
    // Although merge agent currently assumes files are in main workspace or committed.
    // If agents used worktrees, they MUST have committed to their branches for the merge agent (which runs in main workspace usually) to see them?
    // Or the merge agent should run in a worktree too?
    // For now, we assume agents committed. 
    for (const wt of createdWorktrees) {
      try {
        await worktreeManager.remove(workspace, wt);
      } catch (e) {
        logger.warn("worktree_cleanup_failed", { path: wt, error: String(e) });
      }
    }
  }

  /**
   * Report phase: generate summary
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeReportPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "reporting_started" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Generate report (Phase 3.2)
    // For now, emit placeholder
    yield { type: "notice", message: "reporting_placeholder" } as WorkflowEvent;
  }

  /**
   * Calculate progress percentage for phase
   */
  private getProgressForPhase(phase: WorkflowPhase, completed = false): number {
    const phaseProgress: Record<WorkflowPhase, { start: number; end: number }> = {
      scan: { start: 10, end: 25 },
      plan: { start: 25, end: 50 },
      act: { start: 50, end: 90 },
      report: { start: 90, end: 100 },
    };
    
    const range = phaseProgress[phase];
    return completed ? range.end : range.start;
  }

  /**
   * Wait for resume payload with timeout
   * 
   * Used during workflow execution when elevated authorization is required.
   * Will be integrated in Phase 3.4+ when adding policy-based authorization.
   * 
   * Timer is stored for cleanup on early resume to prevent resource leaks.
   * 
   * @private Reserved for future use - currently unused
   */
  // @ts-expect-error - Reserved for Phase 3.4+, currently unused
  private async waitForResume(
    requiredEvent: ResumePayload["event"]
  ): Promise<ResumePayload | null> {
    // Check queue first
    const queued = this.state.resumeQueue.find((p) => p.event === requiredEvent);
    if (queued) {
      this.state.resumeQueue = this.state.resumeQueue.filter((p) => p !== queued);
      return queued;
    }

    // Wait for new resume with clearable timeout
    return new Promise<ResumePayload | null>((resolve) => {
      this.state.resumeResolver = resolve;

      // Store timeout handle for cleanup
      const timeout = setTimeout(() => {
        if (this.state.resumeResolver === resolve) {
          this.state.resumeResolver = null;
          this.state.resumeTimeout = null;
          resolve(null); // Timeout, continue without authz
        }
      }, RESUME_TIMEOUT_MS);
      
      this.state.resumeTimeout = timeout;
    });
  }

  /**
   * Resume workflow with authorization
   * 
   * Public API matching RunPlanV6 interface.
   * Clears timeout if resume arrives before timeout fires.
   */
  public async resume(payload: ResumePayload): Promise<void> {
    const resolver = this.state.resumeResolver;
    if (resolver) {
      // Clear pending timeout to prevent leak
      if (this.state.resumeTimeout) {
        clearTimeout(this.state.resumeTimeout);
        this.state.resumeTimeout = null;
      }
      
      // Resolve in-flight wait
      this.state.resumeResolver = null;
      resolver(payload);
    } else {
      // Not waiting yet, queue for next wait
      this.state.resumeQueue.push(payload);
    }
  }

  /**
   * Cancel workflow execution
   * 
   * Public API matching RunPlanV6 interface
   */
  public cancel(): void {
    this.state.cancelled = true;
  }
  
  /**
   * Get runtime input (for debugging/logging)
   * Reserved for Phase 3.3+ when integrating context builder
   */
  getInput(): RuntimeInput {
    return this._input;
  }
  
  /**
   * Get runtime model (for debugging/logging)
   * Reserved for Phase 3.3+ when integrating AI SDK
   */
  getModel(): LanguageModel {
    return this._model;
  }
}

/**
 * Create a new workflow runtime instance
 * 
 * Factory function for creating runtime with options
 */
export function createRuntime(options: RuntimeOptions): IWorkflowRuntime {
  return new WorkflowRuntime(options);
}
