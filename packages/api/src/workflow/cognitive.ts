import type { Event, Outcome } from "@alfred/cognitive/state";
import type { PipelineEvent } from "@alfred/pipeline";

import { timestamp } from "@alfred/cognitive/state";
import { cognitiveRepo, userRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { RuntimeContext } from "@alfred/type/runtime-context";

const AUTONOMY_BASELINE_PREF_KEY = "cognitive.autonomyBaseline" as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function extractAutonomyLevel(state: unknown): number | undefined {
  if (!state || typeof state !== "object") {
    return;
  }
  const rec = state as Record<string, unknown>;
  const autonomy = rec.autonomy;
  if (!autonomy || typeof autonomy !== "object") {
    return;
  }
  const level = (autonomy as { level?: unknown }).level;
  if (typeof level === "number" && Number.isFinite(level)) {
    return clamp01(level);
  }
}

export interface CognitiveBridgeOptions {
  readonly userId: string;
  readonly runId: string;
  readonly workspace: string;
  readonly requirement: string;
  readonly startedAtMs: number;
  /** For observability/attribution in cognitive runtime context */
  readonly source: "pipeline" | "phase";
  /** Override streamId (default: runId) */
  readonly streamId?: string;
}

export class CognitiveBridge {
  readonly streamId: string;
  readonly runtimeCtx: RuntimeContext;

  private readonly opts: CognitiveBridgeOptions;
  private inputEnsured = false;
  private wroteComplete = false;
  private autonomyLevel: number | undefined;

  constructor(options: CognitiveBridgeOptions) {
    this.opts = options;
    this.streamId = options.streamId ?? options.runId;
    this.runtimeCtx = new RuntimeContext([
      ["userId", options.userId],
      ["runId", options.runId],
      ["workspace", options.workspace],
      ["source", options.source],
    ]);
  }

  async ensureInput(): Promise<number | undefined> {
    if (this.inputEnsured) {
      return this.autonomyLevel;
    }
    this.inputEnsured = true;

    // If a snapshot already exists for this stream, avoid emitting a duplicate input event.
    try {
      const existing = await cognitiveRepo.getLatestSnapshot(this.streamId);
      if (existing?.state) {
        const level = extractAutonomyLevel(existing.state);
        if (typeof level === "number") {
          this.autonomyLevel = level;
          return level;
        }
      }
    } catch (error) {
      logger.warn("cognitive_bridge_snapshot_lookup_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.opts.runId,
        streamId: this.streamId,
      });
    }

    return await this.writeInput();
  }

  private async writeInput(): Promise<number | undefined> {
    try {
      const inputEvent: Event = {
        _: "input",
        content: this.opts.requirement,
        source: "user",
        ts: timestamp(this.opts.startedAtMs),
      };
      const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
      const result = await runCognitiveLoop(
        this.runtimeCtx,
        this.streamId,
        inputEvent
      );
      const level = extractAutonomyLevel(result.state);
      if (typeof level === "number") {
        this.autonomyLevel = level;
      }
      return this.autonomyLevel;
    } catch (error) {
      logger.warn("cognitive_bridge_input_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.opts.runId,
        streamId: this.streamId,
      });
      return;
    }
  }

  async handlePipelineEvent(event: PipelineEvent): Promise<void> {
    if (event.type === "agent:complete") {
      await this.writeAgentFeedback(event);
      return;
    }

    if (
      event.type === "agent:escalate-request" &&
      event.severity === "blocking"
    ) {
      await this.writeEscalateInterrupt(event);
      return;
    }

    if (event.type === "pipeline:complete") {
      await this.writeComplete({
        _: "success",
        duration: Math.max(0, Date.now() - this.opts.startedAtMs),
        result: { runId: this.opts.runId, status: "completed" },
      });
      return;
    }

    if (event.type === "pipeline:failed") {
      await this.writeComplete({
        _: "failure",
        error: event.error,
        recoverable: true,
      });
      return;
    }

    if (event.type === "pipeline:suspend") {
      // Atomic stepping uses "stage_boundary" suspends; do not treat those as terminal outcomes.
      if (event.reason === "stage_boundary") {
        return;
      }
      await this.writeComplete({
        _: "cancelled",
        reason: `pipeline_suspended:${event.reason}`,
      });
    }
  }

  private async writeAgentFeedback(
    event: Extract<PipelineEvent, { type: "agent:complete" }>
  ): Promise<void> {
    try {
      const { status } = event.outcome;
      let similarity: number | undefined;
      if (status === "success") {
        similarity = 1;
      } else if (status === "failure") {
        similarity = 0;
      } else if (status === "timeout" || status === "stuck") {
        similarity = 0;
      } else if (status === "escalated") {
        similarity = 0.25;
      }

      const feedbackEvent: Event = {
        _: "feedback",
        expected: `agent:${event.agentId}:success`,
        actual: `agent:${event.agentId}:${status}`,
        similarity,
        ts: timestamp(event.timestamp),
      };
      const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
      await runCognitiveLoop(this.runtimeCtx, this.streamId, feedbackEvent);
    } catch (error) {
      logger.warn("cognitive_bridge_agent_feedback_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.opts.runId,
        streamId: this.streamId,
        agentId: event.agentId,
      });
    }
  }

  private async writeEscalateInterrupt(
    event: Extract<PipelineEvent, { type: "agent:escalate-request" }>
  ): Promise<void> {
    try {
      const interruptEvent: Event = {
        _: "interrupt",
        reason: `agent_escalate_request:${event.reason}`,
        priority: 2,
        ts: timestamp(event.timestamp),
      };
      const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
      await runCognitiveLoop(this.runtimeCtx, this.streamId, interruptEvent);
    } catch (error) {
      logger.warn("cognitive_bridge_escalate_interrupt_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.opts.runId,
        streamId: this.streamId,
        agentId: event.agentId,
      });
    }
  }

  private async writeComplete(outcome: Outcome): Promise<void> {
    if (this.wroteComplete) {
      return;
    }
    this.wroteComplete = true;

    try {
      const completeEvent: Event = {
        _: "complete",
        outcome,
        ts: timestamp(Date.now()),
      };
      const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
      const result = await runCognitiveLoop(
        this.runtimeCtx,
        this.streamId,
        completeEvent
      );

      const level = extractAutonomyLevel(result.state);
      if (typeof level !== "number") {
        return;
      }

      try {
        await userRepo.setPreference(
          this.opts.userId,
          AUTONOMY_BASELINE_PREF_KEY,
          level,
          1,
          this.opts.source
        );
      } catch (error) {
        logger.warn("cognitive_bridge_autonomy_baseline_set_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: this.opts.runId,
          streamId: this.streamId,
        });
      }
    } catch (error) {
      logger.warn("cognitive_bridge_complete_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.opts.runId,
        streamId: this.streamId,
      });
    }
  }
}

export function createCognitiveBridge(
  options: CognitiveBridgeOptions
): CognitiveBridge {
  return new CognitiveBridge(options);
}
