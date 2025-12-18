/**
 * Header extraction utilities for handling HeadersInit variants.
 *
 * HeadersInit can be:
 * - Headers object
 * - Array of [string, string] tuples
 * - Record<string, string>
 *
 * These utilities provide consistent access regardless of variant.
 */

/**
 * HeadersInit-like type for headers that may be passed to fetch.
 */
type HeadersLike =
  | Headers
  | [string, string][]
  | Record<string, string>
  | undefined
  | null;

/**
 * Extracts a header value from headers (any variant).
 *
 * @param headers - Headers object, array of tuples, or record
 * @param name - Header name (case-insensitive)
 * @returns Header value or null if not found
 */
export function getHeaderValue(
  headers: HeadersLike,
  name: string
): string | null {
  if (!headers) {
    return null;
  }

  const lowerName = name.toLowerCase();

  // Headers object
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  // Array of [key, value] tuples
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === lowerName);
    return entry ? entry[1] : null;
  }

  // Record<string, string>
  if (typeof headers === "object") {
    const record = headers as Record<string, string>;
    // Check exact match first, then case-insensitive
    if (name in record) {
      return record[name] ?? null;
    }
    const key = Object.keys(record).find((k) => k.toLowerCase() === lowerName);
    return key ? (record[key] ?? null) : null;
  }

  return null;
}

/**
 * Checks if a header exists in headers (any variant).
 *
 * @param headers - Headers object, array of tuples, or record
 * @param name - Header name (case-insensitive)
 * @returns true if header exists
 */
export function hasHeader(headers: HeadersLike, name: string): boolean {
  return getHeaderValue(headers, name) !== null;
}

/**
 * Converts headers to a Headers object.
 *
 * @param headers - Headers object, array of tuples, or record
 * @returns Headers object
 */
export function toHeaders(headers: HeadersLike): Headers {
  if (!headers) {
    return new Headers();
  }
  if (headers instanceof Headers) {
    return headers;
  }
  return new Headers(headers as [string, string][] | Record<string, string>);
}
