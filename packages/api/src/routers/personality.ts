/**
 * ALFRED Personality Router
 * API endpoints for personality trait management
 */

import {
  defaultPersonality,
  getPersonalityInstructions,
  type Personality,
  type PersonalityEvent,
  updatePersonality,
} from "@alfred/cognitive/personality";
import * as personalityRepo from "@alfred/db/repo/personality";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// ============================================================================
// Schemas
// ============================================================================

const traitValueSchema = z.number().min(0).max(1);

const personalityUpdateSchema = z.object({
  curiosity: z
    .object({
      explorationRate: traitValueSchema.optional(),
      noveltyBias: traitValueSchema.optional(),
      questionFrequency: traitValueSchema.optional(),
      topicBreadth: traitValueSchema.optional(),
    })
    .optional(),
  deliberation: z
    .object({
      thinkingBudgetMs: z.number().int().min(100).max(60_000).optional(),
      depthPreference: traitValueSchema.optional(),
      uncertaintyTolerance: traitValueSchema.optional(),
      planningHorizon: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
  confidence: z
    .object({
      uncertaintyThreshold: traitValueSchema.optional(),
    })
    .optional(),
  metaLearning: z
    .object({
      strategyUpdateRate: traitValueSchema.optional(),
      patternRecognitionStrength: traitValueSchema.optional(),
      abstractionLevel: traitValueSchema.optional(),
    })
    .optional(),
  skillAcquisition: z
    .object({
      learningRate: traitValueSchema.optional(),
      retentionFactor: traitValueSchema.optional(),
      transferLearning: traitValueSchema.optional(),
      practiceSchedule: z.enum(["massed", "spaced", "adaptive"]).optional(),
    })
    .optional(),
  aesthetics: z
    .object({
      codeStyle: z.string().max(50).optional(),
      outputFormat: z.string().max(50).optional(),
      verbosityLevel: traitValueSchema.optional(),
      explanationDepth: traitValueSchema.optional(),
    })
    .optional(),
});

const goalSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  priority: traitValueSchema,
  deadline: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

const personalityEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("feedback_positive"),
    trait: z.enum([
      "purpose",
      "curiosity",
      "deliberation",
      "confidence",
      "metaLearning",
      "skillAcquisition",
      "aesthetics",
    ]),
    strength: traitValueSchema,
  }),
  z.object({
    type: z.literal("feedback_negative"),
    trait: z.enum([
      "purpose",
      "curiosity",
      "deliberation",
      "confidence",
      "metaLearning",
      "skillAcquisition",
      "aesthetics",
    ]),
    strength: traitValueSchema,
  }),
  z.object({
    type: z.literal("calibration_update"),
    domain: z.string().min(1).max(100),
    accuracy: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("goal_progress"),
    goalId: z.string().min(1),
    progress: traitValueSchema,
  }),
  z.object({
    type: z.literal("goal_completed"),
    goalId: z.string().min(1),
  }),
  z.object({
    type: z.literal("skill_practiced"),
    skill: z.string().min(1).max(100),
    duration: z.number().min(0),
  }),
  z.object({
    type: z.literal("exploration_success"),
    topic: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("exploration_failure"),
    topic: z.string().min(1).max(200),
  }),
]);

// ============================================================================
// Helper Functions
// ============================================================================

async function getOrCreatePersonality(userId: string): Promise<Personality> {
  const row = await personalityRepo.getPersonality(userId);

  if (!row) {
    const defaultTraits = defaultPersonality();
    await personalityRepo.upsertPersonality(userId, defaultTraits);
    return defaultTraits;
  }

  return row.traits as Personality;
}

// ============================================================================
// Router
// ============================================================================

export const personalityRouter = router({
  /**
   * Get current personality traits
   */
  get: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const personality = await getOrCreatePersonality(session.user.id);
    return personality;
  }),

  /**
   * Update personality traits
   */
  update: authedProcedure
    .input(personalityUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const current = await getOrCreatePersonality(session.user.id);

      // Deep merge updates
      const updated: Personality = {
        ...current,
        lastUpdated: new Date(),
      };

      if (input.curiosity) {
        updated.curiosity = { ...current.curiosity, ...input.curiosity };
      }
      if (input.deliberation) {
        updated.deliberation = {
          ...current.deliberation,
          ...input.deliberation,
        };
      }
      if (input.confidence) {
        updated.confidence = { ...current.confidence, ...input.confidence };
      }
      if (input.metaLearning) {
        updated.metaLearning = {
          ...current.metaLearning,
          ...input.metaLearning,
        };
      }
      if (input.skillAcquisition) {
        updated.skillAcquisition = {
          ...current.skillAcquisition,
          ...input.skillAcquisition,
        };
      }
      if (input.aesthetics) {
        updated.aesthetics = { ...current.aesthetics, ...input.aesthetics };
      }

      await personalityRepo.upsertPersonality(session.user.id, updated);

      return updated;
    }),

  /**
   * Apply a personality event (feedback, calibration, etc.)
   */
  applyEvent: authedProcedure
    .input(personalityEventSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const current = await getOrCreatePersonality(session.user.id);
      const updated = updatePersonality(current, input as PersonalityEvent);

      await personalityRepo.upsertPersonality(session.user.id, updated);

      // Record the event
      await personalityRepo.recordEvent(session.user.id, {
        eventType: input.type,
        trait: "trait" in input ? input.trait : input.type,
        reason: `Applied ${input.type} event`,
      });

      return updated;
    }),

  /**
   * Add a goal
   */
  addGoal: authedProcedure
    .input(goalSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const current = await getOrCreatePersonality(session.user.id);

      // Check for duplicate goal ID
      if (current.purpose.goals.some((g) => g.id === input.id)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "goal_id_exists",
        });
      }

      const newGoal = {
        id: input.id,
        description: input.description,
        priority: input.priority as any,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        progress: 0 as any,
        active: input.active,
      };

      const updated: Personality = {
        ...current,
        purpose: {
          ...current.purpose,
          goals: [...current.purpose.goals, newGoal],
        },
        lastUpdated: new Date(),
      };

      await personalityRepo.upsertPersonality(session.user.id, updated);

      return updated.purpose.goals;
    }),

  /**
   * Remove a goal
   */
  removeGoal: authedProcedure
    .input(z.object({ goalId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const current = await getOrCreatePersonality(session.user.id);

      const updated: Personality = {
        ...current,
        purpose: {
          ...current.purpose,
          goals: current.purpose.goals.filter((g) => g.id !== input.goalId),
        },
        lastUpdated: new Date(),
      };

      await personalityRepo.upsertPersonality(session.user.id, updated);

      return updated.purpose.goals;
    }),

  /**
   * Get calibration stats
   */
  calibrationStats: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const calibrations = await personalityRepo.getAllCalibrations(
      session.user.id
    );

    const stats = calibrations.map((cal) => ({
      domain: cal.domain,
      predictionCount: cal.predictionCount ?? 0,
      correctCount: cal.correctCount ?? 0,
      accuracy:
        cal.predictionCount && cal.predictionCount > 0
          ? (cal.correctCount ?? 0) / cal.predictionCount
          : null,
      calibrationError: cal.calibrationError,
      recentAccuracy:
        cal.recentPredictionCount && cal.recentPredictionCount > 0
          ? (cal.recentCorrectCount ?? 0) / cal.recentPredictionCount
          : null,
    }));

    // Calculate overall stats
    const totalPredictions = stats.reduce(
      (sum, s) => sum + s.predictionCount,
      0
    );
    const totalCorrect = stats.reduce((sum, s) => sum + s.correctCount, 0);
    const overallAccuracy =
      totalPredictions > 0 ? totalCorrect / totalPredictions : null;

    return {
      domains: stats,
      overall: {
        totalPredictions,
        totalCorrect,
        accuracy: overallAccuracy,
      },
    };
  }),

  /**
   * Get recent personality events
   */
  events: authedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const events = await personalityRepo.getRecentEvents(
        session.user.id,
        input.limit
      );

      return events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        trait: event.trait,
        previousValue: event.previousValue,
        newValue: event.newValue,
        reason: event.reason,
        timestamp: event.timestamp?.toISOString() ?? null,
      }));
    }),

  /**
   * Get personality-based prompt instructions
   */
  instructions: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const personality = await getOrCreatePersonality(session.user.id);
    const instructions = getPersonalityInstructions(personality);

    return { instructions };
  }),

  /**
   * Reset personality to defaults
   */
  reset: authedProcedure.mutation(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const defaults = defaultPersonality();
    await personalityRepo.upsertPersonality(session.user.id, defaults);

    await personalityRepo.recordEvent(session.user.id, {
      eventType: "reset",
      trait: "all",
      reason: "User requested personality reset",
    });

    return defaults;
  }),
});
