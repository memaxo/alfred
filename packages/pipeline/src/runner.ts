import { resolveStreamId } from "@alfred/cognitive";
import { logger } from "@alfred/logger";
import { TransitionGuard } from "@alfred/resilience/transitions";

import type { ExecutionSummary, PipelineEvent } from "./events";
import type {
  PipelineConfig,
  PipelineContext,
  PipelineStage,
  StageName,
} from "./pipeline";
import type { PipelineSnapshot, SerializableValue } from "./snapshot";
import type { PipelineInput, PipelineResult } from "./stages/types";

import { createPipelineContext } from "./context";
import { createEvent } from "./events";
import { DEFAULT_CONFIG, STAGE_ORDER } from "./pipeline";

export interface PipelineObserver {
  onEvent(event: PipelineEvent): void;
  onComplete?(): void;
}

type StageMap = Map<StageName, PipelineStage<unknown, unknown>>;

/**
 * Metrics tracked during pipeline execution.
 */
interface ExecutionMetrics {
  agentsSpawned: number;
  filesChanged: number;
  learningInsights: number;
}

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
    await Promise.resolve();
    return yield* this.executeFromStage(input, 0, [], [], signal);
  }

  /**
   * Run pipeline up to and including a specific stage.
   * Useful for plan preview (stop at schedule) without execution.
   *
   * @param input - Pipeline input
   * @param stopAfter - Stage name to stop after (inclusive)
   * @param signal - Optional abort signal
   * @returns Generator yielding events, returns the output of stopAfter stage
   */
  async *runUntilStage(
    input: PipelineInput,
    stopAfter: StageName,
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, unknown, void> {
    await Promise.resolve();
    const stopIndex = STAGE_ORDER.indexOf(stopAfter);
    if (stopIndex === -1) {
      throw new Error(`Unknown stage: ${stopAfter}`);
    }
    return yield* this.executeFromStageUntil(
      input,
      0,
      stopIndex,
      [],
      [],
      signal
    );
  }

  /**
   * Resume pipeline from a snapshot until (and including) a specific stage.
   * Useful for atomic stepping without replaying earlier stages.
   */
  async *resumeUntilStage(
    snapshot: PipelineSnapshot,
    input: PipelineInput,
    stopAfter: StageName,
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, unknown, void> {
    await Promise.resolve();
    // Validate snapshot matches input
    if (snapshot.runId !== input.runId) {
      throw new Error(
        `Snapshot runId "${snapshot.runId}" does not match input runId "${input.runId}"`
      );
    }

    // Cannot resume completed pipelines
    if (snapshot.status === "completed") {
      throw new Error("Cannot resume completed pipeline");
    }

    const stopIndex = STAGE_ORDER.indexOf(stopAfter);
    if (stopIndex === -1) {
      throw new Error(`Unknown stage: ${stopAfter}`);
    }

    // Determine starting stage index
    const startStageIndex = snapshot.lastCompletedStageIndex + 1;

    if (startStageIndex >= STAGE_ORDER.length) {
      throw new Error("No stages remaining to execute");
    }

    const startStage = STAGE_ORDER[startStageIndex] as StageName;

    logger.info("pipeline_resume_until", {
      runId: input.runId,
      fromStage: startStage,
      untilStage: stopAfter,
      skippedStages: STAGE_ORDER.slice(0, startStageIndex),
    });

    // Emit resume event
    const resumeEvent = createEvent("pipeline:resume", {
      fromStage: startStage,
    });
    yield resumeEvent;
    this.emit(resumeEvent);

    return yield* this.executeFromStageUntil(
      input,
      startStageIndex,
      stopIndex,
      snapshot.contextEntries,
      snapshot.stageResults,
      signal
    );
  }

  /**
   * Run a single stage with explicit input and context.
   * Useful for executing a prepared plan or testing individual stages.
   *
   * @param stageName - Name of stage to execute
   * @param input - Stage input (output from previous stage)
   * @param ctx - Pipeline context
   * @param signal - Optional abort signal
   * @returns Stage output
   */
  async runStage<TInput, TOutput>(
    stageName: StageName,
    input: TInput,
    ctx: PipelineContext,
    signal?: AbortSignal
  ): Promise<TOutput> {
    const stage = this.stages.get(stageName);
    if (!stage) {
      throw new Error(`Stage not registered: ${stageName}`);
    }

    if (signal?.aborted) {
      throw new Error("pipeline_aborted");
    }

    const timeout = this.config.phaseTimeouts[stageName];
    const timeoutGuard = this.createTimeoutGuard(timeout, stageName);

    try {
      const result = await Promise.race([
        stage.execute(input, ctx),
        timeoutGuard.promise,
      ]);

      // Store stage output in context
      ctx.set(`${stageName}Output`, result);

      return result as TOutput;
    } finally {
      timeoutGuard.cancel();
    }
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
    await Promise.resolve();
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
   * Core execution logic starting from a specific stage index until a stop stage.
   * Used by runUntilStage().
   */
  private async *executeFromStageUntil(
    input: PipelineInput,
    startStageIndex: number,
    stopStageIndex: number,
    initialContext: [string, SerializableValue][],
    previousStageResults: {
      name: StageName;
      durationMs: number;
      status: string;
    }[] = [],
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, unknown, void> {
    const { runId } = input;
    const stageResults = [...previousStageResults];
    let transitionsExhausted = false;
    let pipelineFailedEmitted = false;
    let currentStage: StageName | null = null;
    const { maxTransitions } = this.config;
    const abortError = new Error("pipeline_aborted");
    abortError.name = "AbortError";
    let lastStageOutput: unknown;
    let lastEventType: PipelineEvent["type"] | null = null;

    const transitionGuard = new TransitionGuard(maxTransitions, (count) => {
      transitionsExhausted = true;
      throw new Error(
        `pipeline_max_transitions_exceeded runId=${runId} count=${count} max=${maxTransitions} last=${lastEventType ?? "unknown"}`
      );
    });

    const assertWithinTransitionLimit = (
      eventType: PipelineEvent["type"],
      options: { allowAfterExhausted?: boolean } = {}
    ) => {
      if (transitionsExhausted && options.allowAfterExhausted) {
        return;
      }
      lastEventType = eventType;
      transitionGuard.tick();
    };

    // Create context with initial values
    const ctx = createPipelineContext({
      runId,
      requirement: input.requirement,
      workspace: input.workspace,
      userId: input.userId,
      config: this.config,
      signal,
      emit: (event) => {
        assertWithinTransitionLimit(event.type);
        this.emit(event);
      },
      initialContext,
      emitContextEvents: true,
    });

    try {
      if (ctx.signal.aborted) {
        throw abortError;
      }

      // Emit start event only if starting from beginning
      if (startStageIndex === 0) {
        const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

        const cognitiveStreamId =
          input.cognitive?.streamId ??
          resolveStreamId({ surface: "pipeline", runId: input.runId });
        const autonomyLevelRaw = input.cognitive?.autonomyLevel;
        const autonomyLevel =
          typeof autonomyLevelRaw === "number" &&
          Number.isFinite(autonomyLevelRaw)
            ? clamp01(autonomyLevelRaw)
            : 0.5;

        ctx.set("authz", input.authz ?? null);
        ctx.set("workspace", input.workspace);
        ctx.set("userId", input.userId);
        ctx.set("cognitiveStreamId", cognitiveStreamId);
        ctx.set("autonomyLevel", autonomyLevel);
        ctx.set("linearAuthz", input.linear?.authz ?? null);
        ctx.set("linearSessionId", input.linear?.sessionId ?? null);
        ctx.set("linearSpace", input.linear?.space ?? null);
        ctx.set("linearTeamId", input.linear?.teamId ?? null);
        ctx.set("linearIssueId", input.linear?.issueId ?? null);

        const startEvent = createEvent("pipeline:start", {
          runId,
          requirement: input.requirement,
        });
        assertWithinTransitionLimit(startEvent.type);
        yield startEvent;
        this.emit(startEvent);
      }

      // If caller requested a stage that was already completed, surface its output.
      if (stopStageIndex < startStageIndex) {
        const stopStage = STAGE_ORDER[stopStageIndex] as StageName | undefined;
        if (stopStage) {
          lastStageOutput = ctx.get(`${stopStage}Output`);
        }
      }

      let stageInput: unknown =
        startStageIndex === 0
          ? input
          : this.getResumeInput(ctx, startStageIndex);

      // Execute stages from startStageIndex up to and including stopStageIndex
      const endIndex = Math.min(stopStageIndex + 1, STAGE_ORDER.length);
      for (let i = startStageIndex; i < endIndex; i++) {
        currentStage = STAGE_ORDER[i] as StageName;
        const stage = this.stages.get(currentStage);

        if (!stage) {
          throw new Error(`Stage not registered: ${currentStage}`);
        }

        if (ctx.signal.aborted) {
          throw abortError;
        }

        const enterEvent = createEvent("stage:enter", { stage: currentStage });
        assertWithinTransitionLimit(enterEvent.type);
        yield enterEvent;
        this.emit(enterEvent);

        const stageStart = performance.now();
        const timeout = this.config.phaseTimeouts[currentStage];
        const timeoutGuard = this.createTimeoutGuard(timeout, currentStage);
        const abortGuard = this.createAbortGuard(ctx.signal, abortError);

        try {
          const result = await Promise.race([
            stage.execute(stageInput, ctx),
            timeoutGuard.promise,
            abortGuard.promise,
          ]);

          ctx.set(`${currentStage}Output`, result);
          lastStageOutput = result;

          const durationMs = Math.round(performance.now() - stageStart);
          stageResults.push({
            name: currentStage,
            durationMs,
            status: "success",
          });

          const exitEvent = createEvent("stage:exit", {
            stage: currentStage,
            durationMs,
          });
          assertWithinTransitionLimit(exitEvent.type);
          yield exitEvent;
          this.emit(exitEvent);

          stageInput = result;

          logger.info("pipeline_stage_complete", {
            runId,
            stage: currentStage,
            durationMs,
          });

          const pipelineSuspend = ctx.get<{ reason?: unknown }>(
            "pipelineSuspend"
          );
          if (pipelineSuspend) {
            const reason =
              typeof pipelineSuspend.reason === "string" &&
              pipelineSuspend.reason.length > 0
                ? pipelineSuspend.reason
                : "unknown";
            const suspendEvent = createEvent("pipeline:suspend", {
              reason,
            });
            assertWithinTransitionLimit(suspendEvent.type);
            yield suspendEvent;
            this.emit(suspendEvent);
            return lastStageOutput;
          }
        } catch (error) {
          const durationMs = Math.round(performance.now() - stageStart);
          stageResults.push({
            name: currentStage,
            durationMs,
            status: "failure",
          });

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorEvent = createEvent("stage:error", {
            stage: currentStage,
            error: errorMessage,
          });
          assertWithinTransitionLimit(errorEvent.type, {
            allowAfterExhausted: true,
          });
          yield errorEvent;
          this.emit(errorEvent);

          const failedEvent = createEvent("pipeline:failed", {
            error: errorMessage,
            lastStage: currentStage,
          });
          assertWithinTransitionLimit(failedEvent.type, {
            allowAfterExhausted: true,
          });
          yield failedEvent;
          this.emit(failedEvent);
          pipelineFailedEmitted = true;

          logger.error("pipeline_stage_failed", {
            runId,
            stage: currentStage,
            error: errorMessage,
          });

          throw error;
        } finally {
          timeoutGuard.cancel();
          abortGuard.cancel();
        }
      }

      // Emit suspend event to indicate partial completion
      const suspendEvent = createEvent("pipeline:suspend", {
        reason: "stage_boundary",
      });
      assertWithinTransitionLimit(suspendEvent.type);
      yield suspendEvent;
      this.emit(suspendEvent);

      return lastStageOutput;
    } catch (error) {
      if (!pipelineFailedEmitted) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const lastStage =
          currentStage ?? STAGE_ORDER[startStageIndex] ?? "init";
        const failedEvent = createEvent("pipeline:failed", {
          error: errorMessage,
          lastStage,
        });
        assertWithinTransitionLimit(failedEvent.type, {
          allowAfterExhausted: true,
        });
        yield failedEvent;
        this.emit(failedEvent);
      }
      throw error;
    } finally {
      for (const observer of this.observers) {
        observer.onComplete?.();
      }
    }
  }

  /**
   * Core execution logic starting from a specific stage index.
   * Used by both run() and resume().
   */
  private async *executeFromStage(
    input: PipelineInput,
    startStageIndex: number,
    initialContext: [string, SerializableValue][],
    previousStageResults: {
      name: StageName;
      durationMs: number;
      status: string;
    }[] = [],
    signal?: AbortSignal
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    const { runId } = input;
    const stageResults = [...previousStageResults];
    const startTime = performance.now();
    const metrics: ExecutionMetrics = {
      agentsSpawned: 0,
      filesChanged: 0,
      learningInsights: 0,
    };
    let transitionsExhausted = false;
    let pipelineFailedEmitted = false;
    let currentStage: StageName | null = null;
    const { maxTransitions } = this.config;
    const abortError = new Error("pipeline_aborted");
    abortError.name = "AbortError";
    let lastEventType: PipelineEvent["type"] | null = null;

    const transitionGuard = new TransitionGuard(maxTransitions, (count) => {
      transitionsExhausted = true;
      throw new Error(
        `pipeline_max_transitions_exceeded runId=${runId} count=${count} max=${maxTransitions} last=${lastEventType ?? "unknown"}`
      );
    });

    const assertWithinTransitionLimit = (
      eventType: PipelineEvent["type"],
      options: { allowAfterExhausted?: boolean } = {}
    ) => {
      if (transitionsExhausted && options.allowAfterExhausted) {
        return;
      }
      lastEventType = eventType;
      transitionGuard.tick();
    };

    // Create context with initial values
    const ctx = createPipelineContext({
      runId,
      requirement: input.requirement,
      workspace: input.workspace,
      userId: input.userId,
      config: this.config,
      signal,
      emit: (event) => {
        assertWithinTransitionLimit(event.type);
        this.emit(event);
        this.trackMetrics(event, metrics);
      },
      initialContext,
      emitContextEvents: true,
    });

    try {
      if (ctx.signal.aborted) {
        throw abortError;
      }

      // Emit start event only if starting from beginning
      if (startStageIndex === 0) {
        const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

        const cognitiveStreamId =
          input.cognitive?.streamId ??
          resolveStreamId({ surface: "pipeline", runId: input.runId });
        const autonomyLevelRaw = input.cognitive?.autonomyLevel;
        const autonomyLevel =
          typeof autonomyLevelRaw === "number" &&
          Number.isFinite(autonomyLevelRaw)
            ? clamp01(autonomyLevelRaw)
            : 0.5;

        // Persist cross-stage inputs in context for resume and observers.
        ctx.set("authz", input.authz ?? null);
        ctx.set("workspace", input.workspace);
        ctx.set("userId", input.userId);
        ctx.set("cognitiveStreamId", cognitiveStreamId);
        ctx.set("autonomyLevel", autonomyLevel);
        ctx.set("linearAuthz", input.linear?.authz ?? null);
        ctx.set("linearSessionId", input.linear?.sessionId ?? null);
        ctx.set("linearSpace", input.linear?.space ?? null);
        ctx.set("linearTeamId", input.linear?.teamId ?? null);
        ctx.set("linearIssueId", input.linear?.issueId ?? null);

        const startEvent = createEvent("pipeline:start", {
          runId,
          requirement: input.requirement,
        });
        assertWithinTransitionLimit(startEvent.type);
        yield startEvent;
        this.emit(startEvent);
      }

      // Get last stage output if resuming (need to reconstruct from context)
      let stageInput: unknown =
        startStageIndex === 0
          ? input
          : this.getResumeInput(ctx, startStageIndex);

      // Execute stages from startStageIndex
      for (let i = startStageIndex; i < STAGE_ORDER.length; i++) {
        currentStage = STAGE_ORDER[i] as StageName;
        const stage = this.stages.get(currentStage);

        if (!stage) {
          throw new Error(`Stage not registered: ${currentStage}`);
        }

        if (ctx.signal.aborted) {
          throw abortError;
        }

        const enterEvent = createEvent("stage:enter", { stage: currentStage });
        assertWithinTransitionLimit(enterEvent.type);
        yield enterEvent;
        this.emit(enterEvent);

        const stageStart = performance.now();
        const timeout = this.config.phaseTimeouts[currentStage];
        const timeoutGuard = this.createTimeoutGuard(timeout, currentStage);
        const abortGuard = this.createAbortGuard(ctx.signal, abortError);

        try {
          const result = await Promise.race([
            stage.execute(stageInput, ctx),
            timeoutGuard.promise,
            abortGuard.promise,
          ]);

          // Store stage output in context for resume.
          // Note: ctx.set enforces JSON-serializable storage (with Map/Set/Date conversion).
          ctx.set(`${currentStage}Output`, result);

          const durationMs = Math.round(performance.now() - stageStart);
          stageResults.push({
            name: currentStage,
            durationMs,
            status: "success",
          });

          const exitEvent = createEvent("stage:exit", {
            stage: currentStage,
            durationMs,
          });
          assertWithinTransitionLimit(exitEvent.type);
          yield exitEvent;
          this.emit(exitEvent);

          // Update metrics from execute stage
          if (currentStage === "execute" && result) {
            const execResult = result as { fileChanges?: unknown[] };
            metrics.filesChanged = execResult.fileChanges?.length ?? 0;
          }

          // Pass output as next stage input
          stageInput = result;

          logger.info("pipeline_stage_complete", {
            runId,
            stage: currentStage,
            durationMs,
          });

          const pipelineSuspend = ctx.get<{ reason?: unknown }>(
            "pipelineSuspend"
          );
          if (pipelineSuspend) {
            const reason =
              typeof pipelineSuspend.reason === "string" &&
              pipelineSuspend.reason.length > 0
                ? pipelineSuspend.reason
                : "unknown";
            const suspendEvent = createEvent("pipeline:suspend", {
              reason,
            });
            assertWithinTransitionLimit(suspendEvent.type);
            yield suspendEvent;
            this.emit(suspendEvent);
            return stageInput as PipelineResult;
          }
        } catch (error) {
          const durationMs = Math.round(performance.now() - stageStart);
          stageResults.push({
            name: currentStage,
            durationMs,
            status: "failure",
          });

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorEvent = createEvent("stage:error", {
            stage: currentStage,
            error: errorMessage,
          });
          assertWithinTransitionLimit(errorEvent.type, {
            allowAfterExhausted: true,
          });
          yield errorEvent;
          this.emit(errorEvent);

          const failedEvent = createEvent("pipeline:failed", {
            error: errorMessage,
            lastStage: currentStage,
          });
          assertWithinTransitionLimit(failedEvent.type, {
            allowAfterExhausted: true,
          });
          yield failedEvent;
          this.emit(failedEvent);
          pipelineFailedEmitted = true;

          logger.error("pipeline_stage_failed", {
            runId,
            stage: currentStage,
            error: errorMessage,
          });

          throw error;
        } finally {
          timeoutGuard.cancel();
          abortGuard.cancel();
        }
      }

      // Build final summary
      const totalDurationMs = Math.round(performance.now() - startTime);
      const summary: ExecutionSummary = {
        runId,
        requirement: input.requirement,
        stages: stageResults,
        totalDurationMs,
        agentsSpawned: metrics.agentsSpawned,
        filesChanged: metrics.filesChanged,
        learningInsights: metrics.learningInsights,
      };

      const summaryText = (() => {
        const out = ctx.get<{ summary?: unknown }>("summarizeOutput");
        const text = out?.summary;
        return typeof text === "string" && text.trim().length > 0
          ? text.trim()
          : undefined;
      })();

      const completeEvent = createEvent("pipeline:complete", {
        summary,
        summaryText,
      });
      assertWithinTransitionLimit(completeEvent.type);
      yield completeEvent;
      this.emit(completeEvent);

      // Return final stage output (SummarizeOutput)
      return stageInput as PipelineResult;
    } catch (error) {
      if (!pipelineFailedEmitted) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const lastStage =
          currentStage ?? STAGE_ORDER[startStageIndex] ?? "init";
        const failedEvent = createEvent("pipeline:failed", {
          error: errorMessage,
          lastStage,
        });
        assertWithinTransitionLimit(failedEvent.type, {
          allowAfterExhausted: true,
        });
        yield failedEvent;
        this.emit(failedEvent);
      }
      throw error;
    } finally {
      for (const observer of this.observers) {
        observer.onComplete?.();
      }
    }
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
      case "init": {
        return ctx.get("initOutput");
      }
      case "context": {
        return ctx.get("contextOutput");
      }
      case "plan": {
        return ctx.get("planOutput");
      }
      case "schedule": {
        return ctx.get("scheduleOutput");
      }
      case "execute": {
        return ctx.get("executeOutput");
      }
      case "review": {
        return ctx.get("reviewOutput");
      }
      case "learn": {
        return ctx.get("learnOutput");
      }
      case "summarize": {
        return ctx.get("summarizeOutput");
      }
      default: {
        return;
      }
    }
  }

  private createTimeoutGuard(
    timeoutMs: number,
    stageName: StageName
  ): {
    promise: Promise<never>;
    cancel: () => void;
  } {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutError = new Error(
      `Stage ${stageName} timed out after ${timeoutMs}ms`
    );

    const promise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(timeoutError), timeoutMs);
      timeout?.unref?.();
    });

    const cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    return { promise, cancel };
  }

  private createAbortGuard(
    signal: AbortSignal,
    abortError: Error
  ): {
    promise: Promise<never>;
    cancel: () => void;
  } {
    let active = true;
    let listener: (() => void) | null = null;

    const promise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(abortError);
        return;
      }
      listener = () => {
        if (!active) {
          return;
        }
        reject(abortError);
      };
      signal.addEventListener("abort", listener);
    });

    const cancel = () => {
      active = false;
      if (listener) {
        signal.removeEventListener("abort", listener);
        listener = null;
      }
    };

    return { promise, cancel };
  }
}
