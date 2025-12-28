import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import type {
  AutonomyGradient,
  CognitiveState,
  Event,
} from "@alfred/cognitive/state";
import { idle, initialAutonomy, timestamp } from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo } from "@alfred/db";
import { cosineSimilarity, embedMany } from "@alfred/embed";
import { logger } from "@alfred/logger";
import type { CognitiveEffect } from "@alfred/runtime/cognitive";
import { z } from "zod";
import type { Context } from "../context";
import { requirePolicy } from "../gate";
import { cognitiveFeedbackSubmissionsTotal } from "../metrics";
import { authedProcedure, router } from "../trpc";

const feedbackInput = z.object({
  streamId: z.string().min(1),
  expected: z.string().min(1),
  actual: z.string().optional().default(""),
  ts: z.number().int().optional(),
  surface: z.enum(["chat", "mindscape", "voice"]).optional(),
});

type FeedbackInput = z.infer<typeof feedbackInput>;

const mapResource = (raw: unknown) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    kind: "cognitive" as const,
    id: payload.streamId ?? "default",
    attrs: {
      scope: "self",
    },
  };
};

const buildContext = (raw: unknown, ctx: Context) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    streamId: payload.streamId ?? "default",
    requestId: ctx.runtime.requestId,
    userId: ctx.session?.user.id,
  };
};

async function computeFeedbackSimilarity(
  expected: string,
  actual: string
): Promise<number | null> {
  if (expected === actual) {
    return 1;
  }
  if (expected.length === 0 || actual.length === 0) {
    return 0;
  }

  try {
    const vectors = await embedMany([expected, actual]);
    const expectedVec = vectors[0];
    const actualVec = vectors[1];
    if (!(expectedVec && actualVec)) {
      return null;
    }

    const sim = cosineSimilarity(expectedVec, actualVec);
    return Math.max(0, Math.min(1, sim));
  } catch (error) {
    logger.warn("cognitive_feedback_similarity_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Type guard for snapshot state with optional autonomy
type SnapshotState = CognitiveState & { autonomy?: AutonomyGradient };

/**
 * Reconstruct current cognitive state from snapshot + events
 */
async function reconstructState(
  streamId: string
): Promise<{ state: CognitiveState; autonomy: AutonomyGradient }> {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isEventLike = (value: unknown): value is { _: string } =>
    isRecord(value) && typeof value._ === "string";

  let state: CognitiveState;
  let autonomy: AutonomyGradient;

  // Load from snapshot first
  const snapshot = await cognitiveRepo.getLatestSnapshot(streamId);
  if (snapshot) {
    const snapState = snapshot.state as SnapshotState;
    state = snapState;
    autonomy = snapState.autonomy ?? initialAutonomy(Date.now());
    // Replay events since snapshot
    const events = await cognitiveRepo.getEventsSince(
      streamId,
      snapshot.createdAt
    );
    for (const record of events) {
      const unwrapped = unwrapEventEnvelope(record.payload);
      if (!isEventLike(unwrapped.data)) {
        continue;
      }
      const historicalEvent = unwrapped.data as Event;
      const result = applyTransition(state, autonomy, historicalEvent);
      state = result.state;
      autonomy = result.autonomy;
    }
  } else {
    // No snapshot - return initial idle state
    state = idle(Date.now());
    autonomy = initialAutonomy(Date.now());
  }

  return { state, autonomy };
}

export const cognitiveRouter = router({
  /**
   * Get the current cognitive state for a stream
   */
  state: authedProcedure
    .input(z.object({ streamId: z.string().default("default") }))
    .query(async ({ input }) => {
      const { state, autonomy } = await reconstructState(input.streamId);

      // Extract timestamp based on state type
      const getStateTimestamp = (): number | undefined => {
        switch (state._) {
          case "idle":
            return state.since;
          case "capturing":
          case "thinking":
          case "executing":
            return state.started;
          case "deciding":
            return state.deadline;
          case "reflecting":
            return;
        }
      };

      return {
        state,
        autonomy,
        phase: state._,
        ts: getStateTimestamp(),
      };
    }),

  feedback: authedProcedure
    .use(
      requirePolicy("cognitive.feedback", mapResource, buildContext, {
        handleObligations: "passThrough",
      })
    )
    .input(feedbackInput)
    .mutation(async ({ ctx, input }) => {
      const expected = input.expected.trim();
      const actual = (input.actual ?? "").trim();
      const similarity = await computeFeedbackSimilarity(expected, actual);

      const event: Event = {
        _: "feedback",
        expected,
        actual,
        similarity: similarity ?? undefined,
        ts: timestamp(input.ts ?? Date.now()),
      };

      const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
      const { state, effects } = await runCognitiveLoop(
        ctx.runtimeContext,
        input.streamId,
        event
      );

      await handleCognitiveEffects(ctx.runtimeContext, input.streamId, effects);

      const surface = input.surface ?? "chat";
      cognitiveFeedbackSubmissionsTotal.labels(surface).inc();

      return {
        state,
        obligations: ctx.policy?.obligations ?? [],
      };
    }),
});

async function handleCognitiveEffects(
  runtimeCtx: Context["runtimeContext"],
  streamId: string,
  initialEffects: CognitiveEffect[]
) {
  if (!initialEffects.length) {
    return;
  }

  const { runAssistantGeneration, runCognitiveLoop } = await import(
    "@alfred/runtime/cognitive"
  );
  const queue: CognitiveEffect[] = [...initialEffects];

  while (queue.length > 0) {
    const effect = queue.shift();
    if (!effect) {
      break;
    }
    try {
      switch (effect.type) {
        case "generate_response": {
          const outcome = await runAssistantGeneration(
            runtimeCtx,
            streamId,
            effect.input
          );
          const followUp = await runCognitiveLoop(runtimeCtx, streamId, {
            _: "complete",
            outcome,
            ts: timestamp(Date.now()),
          });
          queue.push(...followUp.effects);
          break;
        }
        case "execute_plan": {
          // Plan execution is handled by workflow runtime
          // This effect indicates the cognitive system has approved execution
          logger.info("cognitive_plan_execution_approved", {
            streamId,
            planSteps: effect.plan.steps.length,
            planConfidence: effect.plan.confidence,
          });
          // Note: Actual plan execution happens through workflow runtime,
          // not directly from cognitive effects. This is just logging.
          break;
        }
        case "log_reflection": {
          // Log reflection outcome for learning
          // In future, this could be sent to LearningEngine
          logger.info("cognitive_reflection_logged", {
            streamId,
            outcomeType: effect.outcome._,
            outcome:
              effect.outcome._ === "success"
                ? "success"
                : effect.outcome._ === "failure"
                  ? effect.outcome.error
                  : effect.outcome._ === "partial"
                    ? `partial: ${effect.outcome.completed.length} completed, ${effect.outcome.failed.length} failed`
                    : effect.outcome.reason,
          });
          // Note: Full learning integration would convert Outcome to SupervisionEvent
          // and send to LearningEngine.recordOutcome(). For now, just log.
          break;
        }
        default: {
          const exhaustive: never = effect;
          logger.warn("cognitive_effect_unknown", {
            streamId,
            effect: exhaustive,
          });
        }
      }
    } catch (error) {
      logger.error("cognitive_effect_failed", {
        streamId,
        effect,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
