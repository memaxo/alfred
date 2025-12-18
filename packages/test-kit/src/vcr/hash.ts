/**
 * VCR Request Hashing
 *
 * Creates deterministic hashes of AI requests for matching
 * recorded responses during replay.
 */

import type { HashOptions, VCRInteraction } from "./types";

/**
 * Creates a stable hash of an object for request matching.
 * Uses a simple but fast hashing approach.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalizes a request body for hashing by removing volatile fields
 */
function normalizeBody(body: unknown, excludeFields: string[] = []): unknown {
  if (body === null || body === undefined) {
    return null;
  }

  if (Array.isArray(body)) {
    return body.map((item) => normalizeBody(item, excludeFields));
  }

  if (typeof body === "object") {
    const normalized: Record<string, unknown> = {};
    const obj = body as Record<string, unknown>;

    // Default volatile fields to exclude
    const defaultExcludes = ["stream", "stream_options", "seed", "user"];
    const allExcludes = [...defaultExcludes, ...excludeFields];

    for (const [key, value] of Object.entries(obj)) {
      if (!allExcludes.includes(key)) {
        normalized[key] = normalizeBody(value, excludeFields);
      }
    }

    // Sort keys for deterministic ordering
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(normalized).sort()) {
      sorted[key] = normalized[key];
    }
    return sorted;
  }

  return body;
}

/**
 * Extracts the model identifier from a request
 */
function extractModel(body: unknown): string {
  if (body && typeof body === "object" && "model" in body) {
    return String((body as Record<string, unknown>).model);
  }
  return "unknown";
}

/**
 * Creates a hash of an AI request for matching
 */
export function hashRequest(
  request: VCRInteraction["request"],
  options: HashOptions = {}
): string {
  const { includeModel = true, excludeBodyFields = [] } = options;

  const normalizedBody = normalizeBody(request.body, excludeBodyFields);
  const model = extractModel(request.body);

  const hashInput: Record<string, unknown> = {
    url: request.url.replace(/^https?:\/\/[^/]+/, ""), // Remove host
    method: request.method,
    body: normalizedBody,
  };

  if (includeModel) {
    hashInput.model = model;
  }

  const hashString = JSON.stringify(hashInput);
  return simpleHash(hashString);
}

/**
 * Default request matcher - matches by hash
 */
export function defaultMatcher(
  request: VCRInteraction["request"],
  recorded: VCRInteraction
): boolean {
  const requestHash = hashRequest(request);
  return requestHash === recorded.requestHash;
}

/**
 * Fuzzy matcher - matches by messages content only
 */
export function fuzzyMatcher(
  request: VCRInteraction["request"],
  recorded: VCRInteraction
): boolean {
  const reqBody = request.body as Record<string, unknown> | null;
  const recBody = recorded.request.body as Record<string, unknown> | null;

  if (!(reqBody?.messages && recBody?.messages)) {
    return defaultMatcher(request, recorded);
  }

  // Compare just the message contents
  const reqMessages = JSON.stringify(reqBody.messages);
  const recMessages = JSON.stringify(recBody.messages);
  return reqMessages === recMessages;
}
