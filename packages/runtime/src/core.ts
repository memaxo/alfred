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

    yield {
      type: "event",
      kind: "execplan-root-created",
      data: {
        runId: this.runId,
        path: `.agent/plans/${this.runId}.root.md`,
        content: rootPlan,
        subtasks: subTasks.map((task) => ({
          id: task.id,
          path: `.agent/plans/${this.runId}/${task.id}.md`,
          skeleton: generateSubtaskExecPlanSkeleton(task, this.runId),
        })),
      },
    } as any;

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
      process.env.NODE_ENV === "test" ||
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
    const { buildMergePlan } = await import(
      "@alfred/agent/orchestrator/multi/merge"
    );
    const { buildReviewPlan } = await import(
      "@alfred/agent/orchestrator/multi/review"
    );
    const { ContextBuilder } = await import("./context");

    const workspace = this._input.workspace ?? process.cwd();

    let trackerState: TrackerState = { agents: {}, waves: {} };
    const agentFileHints = new Map<string, Set<string>>();
    const agentSubTaskIds = new Map<string, string>();

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

        agentOutcomes.push({
          agentId: spec.agentId,
          stuck,
          status: rawStatus,
          durationSeconds,
          role: "worker",
        });
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
      // Skip merge/review when waves are aborted; manual intervention required.
      return;
    }

    const mergeOutcomes = Array.from(agentFileHints.entries()).map(
      ([agentId, files]) => {
        const subTaskId = agentSubTaskIds.get(agentId) ?? "unknown";
        const trackerAgent = trackerState.agents[agentId as any];
        const status = trackerAgent?.status ?? "completed";
        return {
          agentId,
          subTaskId,
          status,
          result: {
            summary: "codex agent execution",
            artifacts: [],
            changes: Array.from(files),
            notes: [],
          },
        };
      }
    );

    const mergePlan = buildMergePlan(mergeOutcomes as any);

    logger.info("multi_agent_merge_plan", {
      runId: this.runId,
      expectedFiles: mergePlan.expectedFiles ?? [],
      summary: mergePlan.summary,
    });

    yield {
      type: "event",
      kind: "merge-plan",
      data: mergePlan,
    } as any;

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
