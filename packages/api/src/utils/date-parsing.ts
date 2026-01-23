/**
 * Date parsing utilities for tRPC router inputs.
 *
 * Handles the common pattern of optional nullable datetime strings
 * from tRPC inputs that need to be converted to Date objects.
 */

/**
 * Parse optional nullable date from tRPC input.
 *
 * Handles three cases:
 * - `undefined` → `undefined` (no change to existing value)
 * - `null` → `null` (clear existing value)
 * - `string` → `Date` (set new value)
 *
 * @example
 * ```typescript
 * parseOptionalDate(undefined) // undefined
 * parseOptionalDate(null) // null
 * parseOptionalDate("2024-01-01T00:00:00Z") // Date object
 * ```
 */
export function parseOptionalDate(
  value: string | null | undefined
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
}
