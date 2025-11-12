import { createHash, randomUUID } from "node:crypto";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const encode = (v: unknown): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return "[circular]";
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(encode);
    if (isPlainObject(v)) {
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

export function makeEventId(payload: { runId: string; type: string; data?: unknown }): string {
  const deterministic = (process.env.DETERMINISTIC_EVENT_IDS || "").toLowerCase();
  if (deterministic === "1" || deterministic === "true" || deterministic === "yes") {
    const s = `${payload.runId}|${payload.type}|${stableStringify(payload.data ?? null)}`;
    return createHash("sha256").update(s).digest("hex");
  }
  return randomUUID();
}

