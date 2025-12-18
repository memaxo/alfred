/**
 * Learning Tool Definitions
 * Input/output schemas for explicit learning and feedback tools.
 */

import { z } from "zod";

// ============================================================================
// learn_record - Record workflow outcome for learning
// ============================================================================

export const learnRecordInputSchema = z.object({
  workflowId: z.string().min(1).describe("Workflow run ID"),
  outcome: z
    .enum(["success", "failure", "partial"])
    .describe("Overall outcome classification"),
  expected: z
    .string()
    .min(1)
    .optional()
    .describe("What was expected (optional)"),
  actual: z.string().min(1).describe("What actually happened"),
  toolSequence: z
    .array(z.string().min(1))
    .optional()
    .describe("Tools used in sequence (optional)"),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional structured context (optional)"),
  authz: z.string().optional().describe("Authorization token"),
});

export type LearnRecordInput = z.infer<typeof learnRecordInputSchema>;

export const learnRecordOutputSchema = z.object({
  recorded: z.boolean().describe("Whether the outcome was recorded"),
  learningId: z.string().describe("ID of the learning record"),
  error: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Prediction error (0-1) when expected vs actual provided"),
});

export type LearnRecordOutput = z.infer<typeof learnRecordOutputSchema>;

// ============================================================================
// learn_pattern - Mark successful patterns for reuse
// ============================================================================

export const learnPatternInputSchema = z.object({
  description: z.string().min(1).describe("Pattern description"),
  toolSequence: z
    .array(z.string().min(1))
    .min(1)
    .describe("Tool sequence that worked"),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Context where pattern applies (optional)"),
  confidence: z.number().min(0).max(1).describe("Confidence (0-1)"),
  domain: z.string().min(1).optional().describe("Domain label (optional)"),
  authz: z.string().optional().describe("Authorization token"),
});

export type LearnPatternInput = z.infer<typeof learnPatternInputSchema>;

export const learnPatternOutputSchema = z.object({
  patternId: z.string().describe("ID of the stored pattern node"),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

export type LearnPatternOutput = z.infer<typeof learnPatternOutputSchema>;

// ============================================================================
// learn_mistake - Record mistakes and corrections
// ============================================================================

export const learnMistakeInputSchema = z.object({
  mistake: z.string().min(1).describe("Description of mistake"),
  correction: z.string().min(1).describe("How it was corrected"),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Context where mistake occurred (optional)"),
  severity: z.enum(["low", "medium", "high"]).describe("Severity level"),
  domain: z.string().min(1).optional().describe("Domain label (optional)"),
  authz: z.string().optional().describe("Authorization token"),
});

export type LearnMistakeInput = z.infer<typeof learnMistakeInputSchema>;

export const learnMistakeOutputSchema = z.object({
  mistakeId: z.string().describe("ID of the stored mistake node"),
  recorded: z.boolean().describe("Whether the mistake was recorded"),
});

export type LearnMistakeOutput = z.infer<typeof learnMistakeOutputSchema>;
