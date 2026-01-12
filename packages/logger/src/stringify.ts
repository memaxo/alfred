import { redactValue, shouldRedactKey } from "./redact";

function serializeError(err: Error): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  };
  if (typeof err.stack === "string") {
    out.stack = err.stack;
  }
  const anyErr = err as unknown as { cause?: unknown };
  if (anyErr && "cause" in anyErr) {
    out.cause = anyErr.cause;
  }
  return out;
}

function serializeMap(m: Map<unknown, unknown>): [unknown, unknown][] {
  const out: [unknown, unknown][] = [];
  for (const e of m.entries()) {
    out.push(e);
  }
  return out;
}

function serializeSet(s: Set<unknown>): unknown[] {
  const out: unknown[] = [];
  for (const v of s.values()) {
    out.push(v);
  }
  return out;
}

export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (k, v) => {
    if (k && shouldRedactKey(k)) {
      return redactValue();
    }

    if (typeof v === "bigint") {
      return v.toString();
    }

    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) {
        return "[Circular]";
      }
      seen.add(v);

      if (v instanceof Error) {
        return serializeError(v);
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      if (v instanceof Map) {
        return serializeMap(v);
      }
      if (v instanceof Set) {
        return serializeSet(v);
      }
    }

    return v;
  });
}
