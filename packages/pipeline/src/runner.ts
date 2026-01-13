import { logger } from "@alfred/logger";
import type { ExecutionSummary, PipelineEvent } from "./events";
import { createEvent } from "./events";
import type {
  PipelineConfig,
  PipelineContext,
  PipelineStage,
  StageName,
} from "./pipeline";
import { DEFAULT_CONFIG, STAGE_ORDER } from "./pipeline";
import type { PipelineInput, PipelineResult } from "./stages/types";

export type PipelineObserver = {
  onEvent(event: PipelineEvent): void;
  onComplete?(): void;
};

type StageMap = Map<StageName, PipelineStage<unknown, unknown>>;

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

  async *run(
    input: PipelineInput
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    const storage = new Map<string, unknown>();
    const stageResults: Array<{
      name: StageName;
      durationMs: number;
      status: string;
    }> = [];
    const startTime = performance.now();
    let agentsSpawned = 0;
    let filesChanged = 0;
    let learningInsights = 0;

    const ctx: PipelineContext = {
      runId: input.runId,
      requirement: input.requirement,
      workspace: input.workspace,
      userId: input.userId,
      signal: new AbortController().signal, // TODO: Pass from input
      config: this.config,
      emit: (event) => {
        this.emit(event);
        // Track metrics from events
        if (event.type === "agent:spawn") {
          agentsSpawned++;
        }
        if (event.type === "learn:insight") {
          learningInsights++;
        }
      },
      get: <T>(key: string) => storage.get(key) as T | undefined,
      set: (key, value) => storage.set(key, value),
    };

    // Store input for first stage
    let stageInput: unknown = input;

    for (const stageName of STAGE_ORDER) {
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
          filesChanged = execResult.fileChanges?.length ?? 0;
          // Store execute output for summarize stage
          ctx.set("executeOutput", result);
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
      agentsSpawned,
      filesChanged,
      learningInsights,
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
