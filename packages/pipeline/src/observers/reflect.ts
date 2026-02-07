import type { SignalsJudgeOutput } from "@alfred/type";

import { logger } from "@alfred/logger";
import { z } from "zod";

import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

const REFLECTION_TIMEOUT_MS = 5000;

// Lazy-loaded metrics — avoid hard coupling pipeline → metrics
interface MetricsCounter {
  inc(labels: Record<string, string>): void;
}
interface MetricsHistogram {
  startTimer(labels: Record<string, string>): () => void;
}

const noopCounter: MetricsCounter = { inc: () => {} };
const noopHistogram: MetricsHistogram = { startTimer: () => () => {} };
let reflectionMetrics = {
  persisted: noopCounter,
  duration: noopHistogram,
};
let metricsLoaded = false;

async function loadMetrics() {
  if (metricsLoaded) {
    return;
  }
  metricsLoaded = true;
  try {
    const m = await import("@alfred/metrics/enrichment");
    reflectionMetrics = {
      persisted:
        m.reflectionLearningsPersistedTotal as unknown as MetricsCounter,
      duration:
        m.reflectionPersistDurationSeconds as unknown as MetricsHistogram,
    };
  } catch {
    // Metrics package not available — degrade silently
  }
}

type PipelineFailedEvent = Extract<PipelineEvent, { type: "pipeline:failed" }>;

/**
 * Zod schema for structured LLM output.
 * Each learning is prescriptive and actionable.
 */
export const learningExtractionSchema = z.object({
  learnings: z
    .array(
      z.object({
        insight: z.string().min(20).max(300),
        category: z.enum([
          "error_handling",
          "architecture",
          "testing",
          "performance",
          "workflow",
          "tooling",
          "other",
        ]),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(5),
});

export type LearningExtraction = z.infer<typeof learningExtractionSchema>;

/**
 * Execution context gathered from existing DB stores.
 * Injected via callback so the pipeline never imports @alfred/db.
 */
export interface ExecutionContext {
  compilation: Record<string, unknown> | null;
  eventSummary: {
    errors: string[];
    toolFailures: string[];
    agentOutcomes: string[];
  };
}

/**
 * Callback to gather execution context from existing DB stores.
 * Injected by the caller (e.g., execute.ts) to avoid pipeline → DB coupling.
 */
export type GatherExecutionContextFn = (
  runId: string
) => Promise<ExecutionContext>;

/**
 * Callback to persist an ephemeral learning to durable cross-run storage.
 * Injected by the caller (e.g., execute.ts) to avoid pipeline → DB coupling.
 */
export type PersistLearningFn = (learning: {
  runId: string;
  taskId: string;
  projectId?: string;
  content: string;
  category: string;
  confidence: number;
  outcome: "success" | "failure";
  source: "llm";
}) => Promise<void>;

export interface ReflectionObserverConfig {
  /** Pipeline run identifier */
  runId: string;
  /** Project UUID for scoping learnings */
  projectId?: string;
  /** Workspace path used as the resource for retrieval */
  workspace: string;
  /**
   * Callback to gather execution context from existing DB stores.
   * When undefined, the LLM extraction is skipped.
   */
  gatherContext?: GatherExecutionContextFn;
  /**
   * Callback to persist learnings to Postgres memory_nodes.
   * When undefined, the persistence step is skipped.
   */
  persistLearning?: PersistLearningFn;
}

export class ReflectionObserver implements PipelineObserver {
  private readonly runId: string;
  private readonly projectId?: string;
  private readonly gatherContext?: GatherExecutionContextFn;
  private readonly persistLearning?: PersistLearningFn;
  private readonly frictionSignals: SignalsJudgeOutput["friction"] = [];
  private readonly spawnedTaskIds = new Set<string>();
  private failedEvent: PipelineFailedEvent | null = null;

  constructor(config: ReflectionObserverConfig) {
    this.runId = config.runId;
    this.projectId = config.projectId;
    this.gatherContext = config.gatherContext;
    this.persistLearning = config.persistLearning;
  }

  onEvent(event: PipelineEvent): void {
    switch (event.type) {
      case "agent:spawn": {
        if (event.taskId) {
          this.spawnedTaskIds.add(event.taskId);
        }
        break;
      }
      case "agent:signal": {
        if (event.signals.friction.length > 0) {
          this.frictionSignals.push(...event.signals.friction);
        }
        break;
      }
      case "pipeline:failed": {
        this.failedEvent = event;
        break;
      }
    }
  }

  onComplete(): void {
    // Gate behind ALFRED_ENRICHMENT — checked by caller who injects callbacks.
    // If no callbacks, we're a no-op.
    if (!this.gatherContext || !this.persistLearning) {
      return;
    }

    // Load metrics once (non-blocking)
    void loadMetrics();

    // Fire-and-forget LLM extraction — never blocks the pipeline
    void this.extractAndPersist();
  }

  private async extractAndPersist(): Promise<void> {
    const work = this.doExtractAndPersist();
    await this.runWithTimeout(work);
  }

  private async doExtractAndPersist(): Promise<void> {
    // 1. Gather execution context from existing DB stores
    let context: ExecutionContext;
    try {
      context = await this.gatherContext!(this.runId);
    } catch (error) {
      logger.warn("reflection_gather_context_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // 2. Build sanitized trace for LLM
    const outcome = this.failedEvent ? "failure" : "success";
    const trace = {
      outcome,
      compilation: context.compilation,
      errors: context.eventSummary.errors.slice(0, 10),
      toolFailures: context.eventSummary.toolFailures.slice(0, 10),
      agentOutcomes: context.eventSummary.agentOutcomes.slice(0, 10),
      frictionSignals: this.frictionSignals.slice(0, 5).map((f) => ({
        description: f.description,
        severity: f.severity,
      })),
    };

    // 3. Call LLM for structured extraction
    let extraction: LearningExtraction;
    try {
      extraction = await this.callLLM(trace);
    } catch (error) {
      logger.warn("reflection_llm_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // 4. Persist each learning
    if (extraction.learnings.length === 0) {
      return;
    }

    const taskIds =
      this.spawnedTaskIds.size > 0 ? [...this.spawnedTaskIds] : [this.runId];

    const endTimer = reflectionMetrics.duration.startTimer({ path: "llm" });

    const calls = taskIds.flatMap((taskId) =>
      extraction.learnings.map((learning) =>
        this.persistLearning!({
          runId: this.runId,
          taskId,
          projectId: this.projectId,
          content: learning.insight,
          category: learning.category,
          confidence: learning.confidence,
          outcome,
          source: "llm",
        })
      )
    );

    const results = await Promise.allSettled(calls);
    endTimer();

    for (const r of results) {
      reflectionMetrics.persisted.inc({
        path: "llm",
        outcome: r.status === "fulfilled" ? "success" : "failure",
      });
    }
  }

  private async callLLM(
    trace: Record<string, unknown>
  ): Promise<LearningExtraction> {
    // Lazy import to avoid loading AI SDK at module init
    const [
      { generateObject },
      { getClassificationModel },
      { LEARNING_EXTRACTION_PROMPT },
    ] = await Promise.all([
      import("ai"),
      import("@alfred/agent/selector"),
      import("./reflect.prompt.js"),
    ]);

    const selection = getClassificationModel();
    const prompt = `${LEARNING_EXTRACTION_PROMPT}\n\n<execution_summary>\n${JSON.stringify(trace)}\n</execution_summary>`;

    const result = await generateObject({
      model: selection.model as Parameters<typeof generateObject>[0]["model"],
      schema: learningExtractionSchema,
      prompt,
    });

    return result.object;
  }

  private async runWithTimeout(promise: Promise<void>): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("reflection_timeout"));
      }, REFLECTION_TIMEOUT_MS);
      timeoutId.unref?.();
    });

    try {
      await Promise.race([promise, timeout]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "reflection_timeout") {
        logger.warn("reflection_timeout", { runId: this.runId });
      } else {
        logger.warn("reflection_persist_failed", {
          runId: this.runId,
          error: msg,
        });
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
