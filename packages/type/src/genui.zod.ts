/**
 * Generative UI Zod Schemas
 *
 * Validation schemas for LLM-generated UI component trees.
 */

import { z } from "zod";

/**
 * Schema for a single UI component.
 *
 * Uses z.lazy() for recursive children support.
 */
export const uiComponentSchema: z.ZodType<{
  component: string;
  props: Record<string, unknown>;
  children?: unknown[];
  key?: string;
}> = z.object({
  component: z.string().min(1, "Component name is required"),
  props: z
    .record(z.string(), z.unknown())
    .optional()
    .transform((val) => val ?? {}),
  children: z.array(z.lazy(() => uiComponentSchema)).optional(),
  key: z.string().optional(),
});

/**
 * Inferred type from the schema.
 */
export type UIComponentInput = z.input<typeof uiComponentSchema>;
export type UIComponentOutput = z.output<typeof uiComponentSchema>;

/**
 * Schema for a data-ui message part.
 */
export const uiDataPartSchema = z.object({
  type: z.literal("data-ui"),
  ui: uiComponentSchema,
  id: z.string().optional(),
});

/**
 * Schema for GenUIToolResult.
 */
export const genUIToolResultSchema = z.object({
  ui: uiComponentSchema,
  data: z.unknown(),
});

/**
 * Validate a UI component schema.
 *
 * @param value - The value to validate
 * @returns Validation result with parsed component or errors
 */
export function validateUIComponent(value: unknown): {
  valid: boolean;
  component?: UIComponentOutput;
  errors?: string[];
} {
  const result = uiComponentSchema.safeParse(value);
  if (result.success) {
    return { valid: true, component: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map(
      (e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}

/**
 * Validate a data-ui part.
 *
 * @param value - The value to validate
 * @returns Validation result
 */
export function validateUIDataPart(value: unknown): {
  valid: boolean;
  part?: z.output<typeof uiDataPartSchema>;
  errors?: string[];
} {
  const result = uiDataPartSchema.safeParse(value);
  if (result.success) {
    return { valid: true, part: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map(
      (e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}
