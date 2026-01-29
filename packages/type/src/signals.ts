/**
 * ALFRED Signals (Factory AI-style)
 *
 * Signals are structured, privacy-preserving summaries of friction and delight
 * identified by an LLM judge over a sanitized session/step trace.
 *
 * IMPORTANT:
 * - Detection is LLM-driven (LLM-as-logic-circuit). Do not implement keyword/regex
 *   detectors for these signals.
 * - Persist only abstracted citations (no raw user quotes, no code, no PII).
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Core enums
// -----------------------------------------------------------------------------

export const signalTimingSchema = z.enum(["leading", "lagging"]);
export type SignalTiming = z.infer<typeof signalTimingSchema>;

export const signalSeveritySchema = z.enum(["high", "medium", "low"]);
export type SignalSeverity = z.infer<typeof signalSeveritySchema>;

// -----------------------------------------------------------------------------
// Friction signals
// -----------------------------------------------------------------------------

/**
 * Initial friction taxonomy from Factory Signals research.
 *
 * Note: This taxonomy may evolve. New types should be added intentionally after
 * evidence, not by ad-hoc branching logic in runtime.
 */
export const frictionSignalTypeSchema = z.enum([
  "error_event",
  "rephrasing_cascade",
  "escalation_tone",
  "platform_confusion",
  "abandoned_tool_flow",
  "backtracking",
  "context_churn",
]);
export type FrictionSignalType = z.infer<typeof frictionSignalTypeSchema>;

export const frictionSignalSchema = z.object({
  type: frictionSignalTypeSchema,
  severity: signalSeveritySchema,
  timing: signalTimingSchema,
  confidence: z.number().min(0).max(1),
  /** Step index within an agentic loop (1-based or 0-based depends on caller; treat as opaque). */
  stepNumber: z.number().int().min(0),
  /** Abstracted description (no raw quotes, no code, no PII). */
  description: z.string().min(1).max(2000),
  /** Abstracted citations describing what happened without exposing content. */
  citations: z.array(z.string().min(1).max(400)).max(8).default([]),
  /** Unix ms timestamp of detection. */
  detectedAt: z.number().int(),
  /** Extensible, JSON-serializable metadata. */
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type FrictionSignal = z.infer<typeof frictionSignalSchema>;

// -----------------------------------------------------------------------------
// Delight signals
// -----------------------------------------------------------------------------

export const delightSignalTypeSchema = z.enum([
  "efficiency_recognition",
  "learning_moment",
  "first_attempt_success",
  "graceful_recovery",
  "rapid_approval",
]);
export type DelightSignalType = z.infer<typeof delightSignalTypeSchema>;

export const delightSignalSchema = z.object({
  type: delightSignalTypeSchema,
  confidence: z.number().min(0).max(1),
  stepNumber: z.number().int().min(0),
  description: z.string().min(1).max(2000),
  citations: z.array(z.string().min(1).max(400)).max(8).default([]),
  detectedAt: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type DelightSignal = z.infer<typeof delightSignalSchema>;

// -----------------------------------------------------------------------------
// Interventions (judge-recommended)
// -----------------------------------------------------------------------------

export const interventionActionSchema = z.enum([
  "clarify",
  "explain",
  "simplify",
  "acknowledge",
  "pause",
  "recover",
  "reinforce",
]);
export type InterventionAction = z.infer<typeof interventionActionSchema>;

export const interventionTimingSchema = z.enum(["immediate", "next_step"]);
export type InterventionTiming = z.infer<typeof interventionTimingSchema>;

export const signalInterventionSchema = z.object({
  action: interventionActionSchema,
  timing: interventionTimingSchema,
  /** Abstracted instruction to inject (no raw user quotes, no code, no PII). */
  message: z.string().min(1).max(2000),
  /** Optional link to the triggering signal. */
  trigger: frictionSignalSchema.optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  decidedAt: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type SignalIntervention = z.infer<typeof signalInterventionSchema>;

// -----------------------------------------------------------------------------
// Judge output schema
// -----------------------------------------------------------------------------

export const signalsJudgeOutputSchema = z.object({
  friction: z.array(frictionSignalSchema).max(12).default([]),
  delight: z.array(delightSignalSchema).max(12).default([]),
  interventions: z.array(signalInterventionSchema).max(6).default([]),
  /** Optional short note about uncertainty or missing info. */
  note: z.string().max(800).optional(),
});
export type SignalsJudgeOutput = z.infer<typeof signalsJudgeOutputSchema>;
