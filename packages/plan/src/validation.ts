/**
 * Plan Input Validation
 *
 * Zod schemas for validating plan generation inputs.
 * Prevents malicious input and ensures data quality.
 */

import { z } from "zod";

export const generatePlanInputSchema = z.object({
  intent: z.object({
    id: z.string().uuid("Invalid intent ID"),
    description: z
      .string()
      .min(10, "Intent must be at least 10 characters")
      .max(2000, "Intent must be under 2000 characters")
      .trim()
      .transform((val) => {
        const sanitized = val
          .replace(/[<>]/g, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "");
        if (sanitized !== val) {
          throw new Error("Invalid characters detected in intent");
        }
        return sanitized;
      })
      .refine((val) => {
        const dangerousPatterns = [
          /<script[^>]*>.*<\/script>/gi,
          /eval\s*\(/gi,
          /document\.(write|cookie|location)/gi,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(val)) {
            return false;
          }
        }
        return true;
      }, "Intent contains potentially dangerous content"),
    source: z.enum(["chat", "voice", "api"], "Invalid source"),
    userId: z.string().uuid("Invalid user ID"),
    timestamp: z.coerce.date("Invalid timestamp"),
    context: z.object({
      existingPatterns: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
      focusedContent: z.string().optional(),
      focusedNodeType: z.string().optional(),
    }),
  }),
  research: z.object({
    external: z.array(z.string()).optional(),
    internal: z
      .object({
        existingCode: z.array(z.string()).optional(),
        patterns: z.array(z.string()).optional(),
        conventions: z.array(z.string()).optional(),
      })
      .optional(),
    metadata: z
      .object({
        totalSources: z.number().optional(),
        tokenCount: z.number().optional(),
        researchDurationMs: z.number().optional(),
      })
      .optional(),
  }),
  options: z.object({
    maxPhases: z
      .number()
      .min(1, "Must have at least 1 phase")
      .max(10, "Cannot have more than 10 phases")
      .optional(),
    preferParallel: z.boolean().optional(),
  }),
});

export const approvePlanInputSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
});

export const rejectPlanInputSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must be under 500 characters")
    .optional(),
});

export const saveTemplateInputSchema = z.object({
  plan: z.object({
    id: z.string().uuid("Invalid plan ID"),
    userId: z.string().uuid("Invalid user ID"),
    status: z.enum(["draft", "approved", "rejected"], "Invalid status"),
    phases: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().min(1, "Phase title required"),
          description: z.string().optional(),
          steps: z
            .array(
              z.object({
                id: z.string(),
                title: z.string().min(1, "Step title required"),
                description: z.string().optional(),
                agent: z
                  .enum(["codex", "research", "review", "orchestrator"])
                  .optional(),
              })
            )
            .optional(),
        })
      )
      .min(1, "At least one phase required"),
  }),
});

export const matchPatternsInputSchema = z.object({
  intent: z
    .string()
    .min(5, "Intent must be at least 5 characters")
    .max(500, "Intent must be under 500 characters")
    .trim(),
  projectId: z.string().optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  maxResults: z.number().min(1).max(20).optional(),
  requireStructuralMatch: z.boolean().optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;
export type ApprovePlanInput = z.infer<typeof approvePlanInputSchema>;
export type RejectPlanInput = z.infer<typeof rejectPlanInputSchema>;
export type SaveTemplateInput = z.infer<typeof saveTemplateInputSchema>;
export type MatchPatternsInput = z.infer<typeof matchPatternsInputSchema>;
