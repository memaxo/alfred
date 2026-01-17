import { logger } from "@alfred/logger";
import { createPipelineContext } from "./context";
import type { ExecutionSummary, PipelineEvent } from "./events";
import { createEvent } from "./events";
import type {
  PipelineConfig,
  PipelineContext,
  PipelineStage,
  StageName,
} from "./pipeline";
import { DEFAULT_CONFIG, STAGE_ORDER } from "./pipeline";
import type { PipelineSnapshot, SerializableValue } from "./snapshot";
import type { PipelineInput, PipelineResult } from "./stages/types";

export type PipelineObserver = {
  onEvent(event: PipelineEvent): void;
  onComplete?(): void;
};

type StageMap = Map<StageName, PipelineStage<unknown, unknown>>;

/**
 * Metrics tracked during pipeline execution.
 */
type ExecutionMetrics = {
  agentsSpawned: number;
  filesChanged: number;
  learningInsights: number;
};

/**
 * Pipeline runner with support for resume from snapshot.
 *
 * Key features:
 * - Stage registration and ordering
 * - Observer pattern for extensibility
 * - Resume from any stage boundary
 * - Timeout handling per stage
 */
export class PipelineRunner {
  private readonly stages: StageMap = new Map();
  private readonly observers: Set<PipelineObserver> = new Set();
  private readonly config: PipelineConfig;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerStage<TInput, TOutput>(stage: PipelineStage<TInput, TOutput>): this {
    this.stages.set(stage.name, stage as PipelineStage<unknown, unknown>);
    return this;
  }

  addObserver(observer: PipelineObserver): this {
    this.observers.add(observer);
    return this;
  }

  removeObserver(observer: PipelineObserver): this {
    this.observers.delete(observer);
    return this;
  }

  private emit(event: PipelineEvent): void {
    for (const observer of this.observers) {
      try {
        observer.onEvent(event);
      } catch (error) {
        logger.warn("pipeline_observer_error", {
          type: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Run pipeline from the beginning.
   */
  async *run(
    input: PipelineInput,
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    return yield* this.executeFromStage(input, 0, [], [], signal);
  }

  /**
   * Resume pipeline from a snapshot.
   * Skips stages that were already completed.
   *
   * @param snapshot - Pipeline snapshot from previous execution
   * @param input - Pipeline input (must match snapshot.runId)
   * @param signal - Optional abort signal for cancellation/suspension
   */
  async *resume(
    snapshot: PipelineSnapshot,
    input: PipelineInput,
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    // Validate snapshot matches input
    if (snapshot.runId !== input.runId) {
      throw new Error(
        `Snapshot runId "${snapshot.runId}" does not match input runId "${input.runId}"`
      );
    }

    // Cannot resume completed or failed pipelines
    if (snapshot.status === "completed") {
      throw new Error("Cannot resume completed pipeline");
    }

    // Determine starting stage index
    const startStageIndex = snapshot.lastCompletedStageIndex + 1;

    if (startStageIndex >= STAGE_ORDER.length) {
      throw new Error("No stages remaining to execute");
    }

    const startStage = STAGE_ORDER[startStageIndex] as StageName;

    logger.info("pipeline_resume", {
      runId: input.runId,
      fromStage: startStage,
      skippedStages: STAGE_ORDER.slice(0, startStageIndex),
    });

    // Emit resume event
    const resumeEvent = createEvent("pipeline:resume", {
      fromStage: startStage,
    });
    yield resumeEvent;
    this.emit(resumeEvent);

    // Execute from the starting stage with restored context
    return yield* this.executeFromStage(
      input,
      startStageIndex,
      snapshot.contextEntries,
      snapshot.stageResults,
      signal
    );
  }

  /**
   * Core execution logic starting from a specific stage index.
   * Used by both run() and resume().
   */
  private async *executeFromStage(
    input: PipelineInput,
    startStageIndex: number,
    initialContext: [string, SerializableValue][],
    previousStageResults: Array<{
      name: StageName;
      durationMs: number;
      status: string;
    }> = [],
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    const stageResults = [...previousStageResults];
    const startTime = performance.now();
    const metrics: ExecutionMetrics = {
      agentsSpawned: 0,
      filesChanged: 0,
      learningInsights: 0,
    };

    // Create context with initial values
    const ctx = createPipelineContext({
      runId: input.runId,
      requirement: input.requirement,
      workspace: input.workspace,
      userId: input.userId,
      config: this.config,
      signal,
      emit: (event) => {
        this.emit(event);
        this.trackMetrics(event, metrics);
      },
      initialContext,
      emitContextEvents: true,
    });

    // Emit start event only if starting from beginning
    if (startStageIndex === 0) {
      const startEvent = createEvent("pipeline:start", {
        runId: input.runId,
        requirement: input.requirement,
      });
      yield startEvent;
      this.emit(startEvent);
    }

    // Get last stage output if resuming (need to reconstruct from context)
    let stageInput: unknown =
      startStageIndex === 0 ? input : this.getResumeInput(ctx, startStageIndex);

    // Execute stages from startStageIndex
    for (let i = startStageIndex; i < STAGE_ORDER.length; i++) {
      const stageName = STAGE_ORDER[i] as StageName;
      const stage = this.stages.get(stageName);

      if (!stage) {
        throw new Error(`Stage not registered: ${stageName}`);
      }

      const enterEvent = createEvent("stage:enter", { stage: stageName });
      yield enterEvent;
      this.emit(enterEvent);

      const stageStart = performance.now();

      try {
        const timeout = this.config.phaseTimeouts[stageName];
        const result = await this.executeWithTimeout(
          stage.execute(stageInput, ctx),
          timeout,
          stageName
        );

        const durationMs = Math.round(performance.now() - stageStart);
        stageResults.push({ name: stageName, durationMs, status: "success" });

        const exitEvent = createEvent("stage:exit", {
          stage: stageName,
          durationMs,
        });
        yield exitEvent;
        this.emit(exitEvent);

        // Update metrics from execute stage
        if (stageName === "execute" && result) {
          const execResult = result as { fileChanges?: unknown[] };
          metrics.filesChanged = execResult.fileChanges?.length ?? 0;
        }

        // Pass output as next stage input
        stageInput = result;

        logger.info("pipeline_stage_complete", {
          runId: input.runId,
          stage: stageName,
          durationMs,
        });
      } catch (error) {
        const durationMs = Math.round(performance.now() - stageStart);
        stageResults.push({ name: stageName, durationMs, status: "failure" });

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorEvent = createEvent("stage:error", {
          stage: stageName,
          error: errorMessage,
        });
        yield errorEvent;
        this.emit(errorEvent);

        const failedEvent = createEvent("pipeline:failed", {
          error: errorMessage,
          lastStage: stageName,
        });
        yield failedEvent;
        this.emit(failedEvent);

        logger.error("pipeline_stage_failed", {
          runId: input.runId,
          stage: stageName,
          error: errorMessage,
        });

        throw error;
      }
    }

    // Build final summary
    const totalDurationMs = Math.round(performance.now() - startTime);
    const summary: ExecutionSummary = {
      runId: input.runId,
      requirement: input.requirement,
      stages: stageResults,
      totalDurationMs,
      agentsSpawned: metrics.agentsSpawned,
      filesChanged: metrics.filesChanged,
      learningInsights: metrics.learningInsights,
    };

    const completeEvent = createEvent("pipeline:complete", { summary });
    yield completeEvent;
    this.emit(completeEvent);

    // Notify observers of completion
    for (const observer of this.observers) {
      observer.onComplete?.();
    }

    // Return final stage output (SummarizeOutput)
    return stageInput as PipelineResult;
  }

  /**
   * Track metrics from events.
   */
  private trackMetrics(event: PipelineEvent, metrics: ExecutionMetrics): void {
    if (event.type === "agent:spawn") {
      metrics.agentsSpawned++;
    }
    if (event.type === "learn:insight") {
      metrics.learningInsights++;
    }
  }

  /**
   * Get the input for a stage when resuming.
   * Reconstructs from context based on stage index.
   */
  private getResumeInput(ctx: PipelineContext, stageIndex: number): unknown {
    if (stageIndex === 0) {
      return;
    }

    // Each stage stores its output in context
    // We need to get the output of the previous stage
    const previousStage = STAGE_ORDER[stageIndex - 1] as StageName;

    switch (previousStage) {
      case "init":
        return ctx.get("initOutput");
      case "context":
        return ctx.get("contextOutput");
      case "plan":
        return ctx.get("planOutput");
      case "schedule":
        return ctx.get("scheduleOutput");
      case "execute":
        return ctx.get("executeOutput");
      case "review":
        return ctx.get("reviewOutput");
      case "learn":
        return ctx.get("learnOutput");
      case "summarize":
        return ctx.get("summarizeOutput");
      default:
        return;
    }
  }

  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    stageName: StageName
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Stage ${stageName} timed out after ${timeoutMs}ms`)
          );
        }, timeoutMs);
      }),
    ]);
  }
}
