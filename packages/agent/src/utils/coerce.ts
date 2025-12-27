/**
 * Coerces an unknown value to a record.
 * Handles objects directly, parses JSON strings, returns empty object for other types.
 */
export function coerceRecord(val: unknown): Record<string, unknown> {
  if (!val) {
    return {};
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

/**
 * Coerces an unknown value to a non-empty string or null.
 */
export function coerceNonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

/**
 * Coerces a string env var to boolean with fallback.
 */
export function coerceBool(
  val: string | undefined,
  fallback: boolean
): boolean {
  if (val === undefined) {
    return fallback;
  }
  if (val === "1" || val.toLowerCase() === "true") {
    return true;
  }
  if (val === "0" || val.toLowerCase() === "false") {
    return false;
  }
  return fallback;
}

/**
 * Parses a string env var to integer with fallback.
 */
export function toInt(val: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(val ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parses a string env var to float with fallback.
 */
export function toFloat(val: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(val ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}
