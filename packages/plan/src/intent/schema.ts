import { z } from "zod";

/**
 * Zod schema for ClarificationQuestion
 */
export const clarificationQuestionSchema = z.object({
  id: z.string().uuid().or(z.string()),
  question: z
    .string()
    .min(1)
    .describe("The clarification question to ask the user"),
  options: z
    .array(z.string())
    .optional()
    .describe("Multiple choice options for the user"),
  required: z.boolean().default(true),
});

/**
 * Zod schema for Constraint
 */
export const constraintSchema = z.object({
  type: z.string(),
  value: z.string(),
  reason: z.string().optional(),
});

/**
 * Zod schema for WorkflowIntent
 */
export const workflowIntentSchema: z.ZodType<any> = z.object({
  id: z.string().uuid().or(z.string()),
  description: z.string().min(1),
  source: z.enum(["voice", "chat", "api"]),
  userId: z.string(),
  timestamp: z.date().or(
    z
      .string()
      .datetime()
      .transform((s) => new Date(s))
  ),
  context: z.object({
    codebase: z.string().optional(),
    workspace: z.string().optional(),
    existingPatterns: z.array(z.unknown()), // Pattern validation deferred
    constraints: z.array(constraintSchema),
  }),
  ambiguity: z
    .object({
      score: z.number().min(0).max(1),
      questions: z.array(clarificationQuestionSchema),
    })
    .optional(),
  multiIntent: z
    .object({
      split: z.boolean(),
      intents: z.array(z.lazy(() => workflowIntentSchema)),
    })
    .optional(),
});

/**
 * AI-specific schema for structured output
 */
export const intentParserOutputSchema = z.object({
  description: z.string().describe("Concise description of the user's intent"),
  ambiguity: z
    .object({
      score: z
        .number()
        .min(0)
        .max(1)
        .describe("Ambiguity score (0.0-1.0), higher = more ambiguous"),
      questions: z
        .array(
          z.object({
            question: z.string().describe("Specific clarification question"),
            options: z
              .array(z.string())
              .optional()
              .describe("Suggested multiple choice options"),
          })
        )
        .describe("Questions to resolve ambiguity"),
    })
    .describe("Ambiguity detection results"),
  multiIntent: z
    .object({
      split: z
        .boolean()
        .describe("Whether this should be split into multiple intents"),
      parts: z
        .array(z.string())
        .describe("The individual intent descriptions if split"),
    })
    .describe("Multi-intent splitting results"),
});
