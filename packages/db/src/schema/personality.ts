/**
 * ALFRED Personality Schema
 * User personality traits for cognitive behavior modulation
 */

import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * User personality - cognitive traits that modulate behavior
 *
 * Traits are stored as a JSON object with the following structure:
 * {
 *   purpose: { goals: Goal[], activeOptimization: boolean },
 *   curiosity: { explorationRate: number, noveltyBias: number },
 *   deliberation: { thinkingBudgetMs: number, depthPreference: number },
 *   confidence: { calibrationError: number, uncertaintyThreshold: number },
 *   metaLearning: { strategyUpdateRate: number },
 *   skillAcquisition: { learningRate: number, retentionFactor: number },
 *   aesthetics: { codeStyle: string, outputFormat: string }
 * }
 */
export const userPersonality = pgTable("user_personality", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(), // References better_auth.users

  // Personality traits (see type definition in @alfred/type/personality)
  traits: jsonb("traits").notNull(),

  // Computed autonomy level based on traits + physiology
  effectiveAutonomy: real("effective_autonomy").default(0.5),

  // Last trait update timestamp (for decay calculations)
  traitsUpdated: timestamp("traits_updated_at", {
    withTimezone: true,
  }).defaultNow(),

  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Personality calibration history - track prediction accuracy for confidence calibration
 */
export const personalityCalibration = pgTable("personality_calibration", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Domain-specific calibration
  domain: text("domain").notNull(), // "coding" | "planning" | "research" | etc.

  // Calibration metrics
  predictionCount: integer("prediction_count").default(0),
  correctCount: integer("correct_count").default(0),
  calibrationError: real("calibration_error"), // Brier score or similar

  // Time-windowed stats (last 7 days rolling)
  recentPredictionCount: integer("recent_prediction_count").default(0),
  recentCorrectCount: integer("recent_correct_count").default(0),

  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Personality events - log of trait-affecting events for analysis
 */
export const personalityEvents = pgTable("personality_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Event details
  eventType: text("event_type").notNull(), // "feedback" | "success" | "failure" | "calibration"
  trait: text("trait").notNull(), // Which trait was affected
  previousValue: real("previous_value"),
  newValue: real("new_value"),

  // Context
  reason: text("reason"), // Human-readable reason for change
  metadata: jsonb("metadata"), // Additional context

  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});
