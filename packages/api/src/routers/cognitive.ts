import type {
  AutonomyGradient,
  CognitiveState,
  Event,
} from "@alfred/cognitive/state";
import type { CognitiveEffect } from "@alfred/runtime/cognitive";

import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { idle, initialAutonomy, timestamp } from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo } from "@alfred/db";
import { cosineSimilarity, embedMany } from "@alfred/embed";
import { getAccuracyMetrics, getInsights, getMistakes } from "@alfred/learning";
import { logger } from "@alfred/logger";
import { z } from "zod";

import type { Context } from "../context";

import { requirePolicy } from "../gate";
import { cognitiveFeedbackSubmissionsTotal } from "../metrics";
import { authedProcedure, router } from "../trpc";
import { ensureHooksRuntime } from "../workflow/hooks";

const feedbackInput = z.object({
  actual: z.string().optional().default(""),
  expected: z.string().min(1),
  streamId: z.string().min(1),
  surface: z.enum(["chat", "mindscape", "voice"]).optional(),
  ts: z.number().int().optional(),
});

type FeedbackInput = z.infer<typeof feedbackInput>;

const mapResource = (raw: unknown) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    attrs: {
      scope: "self",
    },
    id: payload.streamId ?? "default",
    kind: "cognitive" as const,
  };
};

const buildContext = (raw: unknown, ctx: Context) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    requestId: ctx.runtime.requestId,
    streamId: payload.streamId ?? "default",
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
      ({ state } = result);
      ({ autonomy } = result);
    }
  } else {
    // No snapshot - return initial idle state
    state = idle(Date.now());
    autonomy = initialAutonomy(Date.now());
  }

  return { autonomy, state };
}

// Autonomy scope definitions
const AUTONOMY_SCOPES = [
  "code",
  "filesystem",
  "network",
  "system",
  "sensitive",
] as const;
type AutonomyScope = (typeof AUTONOMY_SCOPES)[number];

// In-memory autonomy settings (would be persisted in production)
const autonomySettings = new Map<string, Map<AutonomyScope, number>>();

function getUserAutonomy(userId: string): Map<AutonomyScope, number> {
  if (!autonomySettings.has(userId)) {
    const defaults = new Map<AutonomyScope, number>();
    defaults.set("code", 0.8);
    defaults.set("filesystem", 0.6);
    defaults.set("network", 0.5);
    defaults.set("system", 0.3);
    defaults.set("sensitive", 0.2);
    autonomySettings.set(userId, defaults);
  }
  return autonomySettings.get(userId) ?? new Map();
}

function getAutonomyScopeDescription(scope: AutonomyScope): string {
  const descriptions: Record<AutonomyScope, string> = {
    code: "Code generation and modifications",
    filesystem: "File system read/write operations",
    network: "Network requests and API calls",
    sensitive: "Operations involving sensitive data",
    system: "System commands and shell execution",
  };
  return descriptions[scope];
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
          case "idle": {
            return state.since;
          }
          case "capturing":
          case "thinking":
          case "executing": {
            return state.started;
          }
          case "deciding": {
            return state.deadline;
          }
          case "reflecting": {
            return;
          }
        }
      };

      return {
        autonomy,
        phase: state._,
        state,
        ts: getStateTimestamp(),
      };
    }),

  /**
   * Get the latest physiological state
   */
  physiologyGet: authedProcedure
    .input(z.object({ streamId: z.string().default("default") }))
    .query(async ({ input }) => {
      const { state } = await reconstructState(input.streamId);
      return state.physiology;
    }),

  /**
   * List feedback/mistake history from the learning ledger
   */
  feedbackList: authedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        since: z.string().datetime().optional(),
      })
    )
    .query(({ input }) => {
      const mistakes = getMistakes({
        category: input.category,
        limit: input.limit,
        since: input.since ? new Date(input.since) : undefined,
      });

      return {
        entries: mistakes.map((m) => ({
          category: m.category,
          cause: m.cause,
          context: m.context,
          effect: m.effect,
          id: m.id,
          timestamp: m.ts,
        })),
        total: mistakes.length,
      };
    }),

  /**
   * Get current autonomy levels per scope
   */
  autonomyGet: authedProcedure.query(({ ctx }) => {
    const userId = ctx.session?.user?.id ?? "anonymous";
    const settings = getUserAutonomy(userId);

    const scopes = AUTONOMY_SCOPES.map((scope) => ({
      description: getAutonomyScopeDescription(scope),
      level: settings.get(scope) ?? 0.5,
      scope,
    }));

    return { scopes };
  }),

  /**
   * Update autonomy level for a specific scope
   */
  autonomySet: authedProcedure
    .input(
      z.object({
        level: z.number().min(0).max(1),
        scope: z.enum(AUTONOMY_SCOPES),
      })
    )
    .mutation(({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? "anonymous";
      const settings = getUserAutonomy(userId);
      settings.set(input.scope, input.level);

      logger.info("cognitive_autonomy_updated", {
        level: input.level,
        scope: input.scope,
        userId,
      });

      return {
        level: input.level,
        scope: input.scope,
        updated: true,
      };
    }),

  /**
   * Get accuracy metrics by category
   */
  metricsAccuracy: authedProcedure.query(() => {
    const metrics = getAccuracyMetrics();
    return {
      metrics: metrics.map((m) => ({
        category: m.category,
        errorRate: m.errorRate,
        total: m.total,
        trend: m.trend,
      })),
    };
  }),

  /**
   * Get learning insights
   */
  insightsList: authedProcedure.query(() => {
    const insights = getInsights();
    return {
      insights: insights.map((i) => ({
        actionable: i.actionable,
        category: i.category,
        confidence: i.confidence,
        description: i.description,
        id: i.id,
        title: i.title,
        type: i.type,
      })),
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

      await ensureHooksRuntime(ctx.runtimeContext, {
        sessionId: ctx.session?.session.id,
        signal: new AbortController().signal,
        workspace: process.cwd(),
        workflowId: input.streamId,
      });

      const event: Event = {
        _: "feedback",
        actual,
        expected,
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
        obligations: ctx.policy?.obligations ?? [],
        state,
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

  const { runAssistantGeneration, runCognitiveLoop } =
    await import("@alfred/runtime/cognitive");
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
            planConfidence: effect.plan.confidence,
            planSteps: effect.plan.steps.length,
            streamId,
          });
          // Note: Actual plan execution happens through workflow runtime,
          // not directly from cognitive effects. This is just logging.
          break;
        }
        case "log_reflection": {
          // Log reflection outcome for learning
          // In future, this could be sent to LearningEngine
          logger.info("cognitive_reflection_logged", {
            outcome:
              effect.outcome._ === "success"
                ? "success"
                : effect.outcome._ === "failure"
                  ? effect.outcome.error
                  : effect.outcome._ === "partial"
                    ? `partial: ${effect.outcome.completed.length} completed, ${effect.outcome.failed.length} failed`
                    : effect.outcome.reason,
            outcomeType: effect.outcome._,
            streamId,
          });
          // Note: Full learning integration would convert Outcome to SupervisionEvent
          // and send to LearningEngine.recordOutcome(). For now, just log.
          break;
        }
        default: {
          const exhaustive: never = effect;
          logger.warn("cognitive_effect_unknown", {
            effect: exhaustive,
            streamId,
          });
        }
      }
    } catch (error) {
      logger.error("cognitive_effect_failed", {
        effect,
        error: error instanceof Error ? error.message : String(error),
        streamId,
      });
    }
  }
}
