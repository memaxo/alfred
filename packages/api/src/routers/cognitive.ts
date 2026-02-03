import type {
  AutonomyGradient,
  CognitiveState,
  Event,
} from "@alfred/cognitive/state";
import type { CognitiveEffect } from "@alfred/runtime/cognitive";

import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { idle, initialAutonomy, timestamp } from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { cognitiveRepo, userRepo } from "@alfred/db";
import { cosineSimilarity, embedMany } from "@alfred/embed";
import { getAccuracyMetrics, getInsights, getMistakes } from "@alfred/learning";
import { logger } from "@alfred/logger";
import { z } from "zod";

import type { Context } from "../context";

import { requirePolicy } from "../gate";
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

const AUTONOMY_BASELINE_PREF_KEY = "cognitive.autonomyBaseline" as const;

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

const AUTONOMY_DEFAULTS: Readonly<Record<AutonomyScope, number>> = {
  code: 0.8,
  filesystem: 0.6,
  network: 0.5,
  system: 0.3,
  sensitive: 0.2,
} as const;

const AUTONOMY_PREF_PREFIX = "cognitive.autonomy." as const;

// Fallback only: used when DB is unavailable.
const fallbackAutonomySettings = new Map<string, Map<AutonomyScope, number>>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseAutonomyLevel(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp01(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clamp01(parsed);
    }
  }
  return null;
}

function getFallbackAutonomy(userId: string): Map<AutonomyScope, number> {
  const existing = fallbackAutonomySettings.get(userId);
  if (existing) {
    return existing;
  }
  const defaults = new Map<AutonomyScope, number>();
  for (const scope of AUTONOMY_SCOPES) {
    defaults.set(scope, AUTONOMY_DEFAULTS[scope]);
  }
  fallbackAutonomySettings.set(userId, defaults);
  return defaults;
}

async function getPersistedAutonomy(
  userId: string
): Promise<Map<AutonomyScope, number> | null> {
  try {
    const prefs = (await userRepo.getPreferences(userId)) as unknown as {
      key?: unknown;
      value?: unknown;
    }[];

    const settings = new Map<AutonomyScope, number>();
    for (const scope of AUTONOMY_SCOPES) {
      settings.set(scope, AUTONOMY_DEFAULTS[scope]);
    }

    for (const pref of prefs) {
      const { key } = pref;
      if (typeof key !== "string" || !key.startsWith(AUTONOMY_PREF_PREFIX)) {
        continue;
      }
      const scope = key.slice(AUTONOMY_PREF_PREFIX.length);
      if (!AUTONOMY_SCOPES.includes(scope as AutonomyScope)) {
        continue;
      }
      const level = parseAutonomyLevel(pref.value);
      if (level === null) {
        continue;
      }
      settings.set(scope as AutonomyScope, level);
    }

    return settings;
  } catch (error) {
    logger.warn("cognitive_autonomy_prefs_load_failed", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return null;
  }
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
   * List recent cognitive events for a stream (sanitized)
   */
  eventsList: authedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).optional().default(50),
        streamId: z.string().default("default"),
      })
    )
    .query(async ({ input }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

      const parseTs = (raw: unknown): number | null => {
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return raw;
        }
        if (raw instanceof Date) {
          return raw.getTime();
        }
        if (typeof raw === "string") {
          const parsed = Date.parse(raw);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      try {
        const newestFirst = await cognitiveRepo.getLatestEvents(
          input.streamId,
          input.limit
        );
        const records = newestFirst.slice().reverse();

        const events = records
          .map((record) => {
            const envelope = unwrapEventEnvelope(record.payload);
            const data = envelope.data;
            if (!isRecord(data) || typeof data._ !== "string") {
              return null;
            }

            const kind = data._;
            const ts = parseTs(data.ts) ?? parseTs(record.createdAt) ?? null;

            if (kind === "input") {
              return {
                id: record.id,
                kind,
                source: typeof data.source === "string" ? data.source : null,
                ts,
              };
            }
            if (kind === "feedback") {
              return {
                id: record.id,
                kind,
                similarity:
                  typeof data.similarity === "number" &&
                  Number.isFinite(data.similarity)
                    ? clamp01(data.similarity)
                    : null,
                ts,
              };
            }
            if (kind === "interrupt") {
              return {
                id: record.id,
                kind,
                priority:
                  typeof data.priority === "number" &&
                  Number.isFinite(data.priority)
                    ? data.priority
                    : null,
                reason: typeof data.reason === "string" ? data.reason : null,
                ts,
              };
            }
            if (kind === "complete") {
              const outcome = isRecord(data.outcome) ? data.outcome : null;
              const outcomeType =
                outcome && typeof outcome._ === "string" ? outcome._ : null;
              const error =
                outcomeType === "failure" && typeof outcome?.error === "string"
                  ? outcome.error
                  : null;
              return {
                id: record.id,
                kind,
                outcome: outcomeType,
                error,
                ts,
              };
            }

            return {
              id: record.id,
              kind,
              ts,
            };
          })
          .filter((e) => e !== null);

        return { events };
      } catch (error) {
        logger.warn("cognitive_events_list_failed", {
          error: error instanceof Error ? error.message : String(error),
          streamId: input.streamId,
        });
        return { events: [] };
      }
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
  autonomyGet: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id ?? "anonymous";
    const persisted = await getPersistedAutonomy(userId);
    const settings = persisted ?? getFallbackAutonomy(userId);

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
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? "anonymous";
      const settings = getFallbackAutonomy(userId);
      settings.set(input.scope, input.level);

      const prefKey = `${AUTONOMY_PREF_PREFIX}${input.scope}`;
      try {
        await userRepo.setPreference(userId, prefKey, input.level, 1, "user");
      } catch (error) {
        logger.warn("cognitive_autonomy_prefs_set_failed", {
          error: error instanceof Error ? error.message : String(error),
          scope: input.scope,
          userId,
        });
      }

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

      const userId = ctx.session?.user?.id;
      const rawLevel = (state as unknown as { autonomy?: { level?: unknown } })
        .autonomy?.level;
      if (
        typeof userId === "string" &&
        typeof rawLevel === "number" &&
        Number.isFinite(rawLevel)
      ) {
        try {
          await userRepo.setPreference(
            userId,
            AUTONOMY_BASELINE_PREF_KEY,
            clamp01(rawLevel),
            1,
            "cognitive"
          );
        } catch (error) {
          logger.warn("cognitive_autonomy_baseline_set_failed", {
            error: error instanceof Error ? error.message : String(error),
            userId,
          });
        }
      }

      await handleCognitiveEffects(ctx.runtimeContext, input.streamId, effects);

      const surface = input.surface ?? "chat";
      try {
        const { cognitiveFeedbackSubmissionsTotal } =
          await import("@alfred/metrics/shared");
        cognitiveFeedbackSubmissionsTotal.labels(surface).inc();
      } catch {
        // Metrics failures must never break the route.
      }

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
