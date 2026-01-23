/**
 * Reusable Zod schemas for tRPC router inputs.
 *
 * Common patterns for date parsing, validation, and transformation.
 */

import { z } from "zod";

/**
 * Zod schema for optional nullable datetime strings.
 *
 * Transforms:
 * - `undefined` → `undefined` (no change to existing value)
 * - `null` → `null` (clear existing value)
 * - `string` → `Date` (set new value)
 *
 * @example
 * ```typescript
 * const input = z.object({
 *   due: optionalNullableDateSchema,
 * });
 * // Input: { due: "2024-01-01T00:00:00Z" } → Output: { due: Date }
 * // Input: { due: null } → Output: { due: null }
 * // Input: {} → Output: { due: undefined }
 * ```
 */
export const optionalNullableDateSchema = z
  .union([z.string().datetime(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) {
      return undefined;
    }
    if (val === null) {
      return null;
    }
    return new Date(val);
  });
