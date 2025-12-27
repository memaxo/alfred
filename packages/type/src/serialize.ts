import { createHash } from "node:crypto";

/**
 * Deterministically stringifies any JS value.
 * Features:
 * - Sorted keys for objects
 * - Circular reference handling
 */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const encode = (v: unknown): any => {
    if (v === null || typeof v !== "object") {
      return v;
    }
    if (seen.has(v as object)) {
      return "[circular]";
    }
    seen.add(v as object);
    if (Array.isArray(v)) {
      return v.map(encode);
    }

    // Check if it's a plain object
    if (
      !!v &&
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) {
        out[key] = encode((v as Record<string, unknown>)[key]);
      }
      return out;
    }

    // Fallback for other objects
    return String(v);
  };
  return JSON.stringify(encode(value));
}

/**
 * Generates a deterministic ID based on content.
 * Useful for event deduplication and replays.
 */
export function makeDeterministicId(payload: {
  prefix?: string;
  namespace: string;
  type: string;
  data?: unknown;
}): string {
  const s = `${payload.namespace}|${payload.type}|${stableStringify(payload.data ?? null)}`;
  const hash = createHash("sha256").update(s).digest("hex");
  return payload.prefix ? `${payload.prefix}_${hash}` : hash;
}
