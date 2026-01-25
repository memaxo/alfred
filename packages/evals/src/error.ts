import type { SerializedError } from "./events.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function getErrCode(err: unknown): string | undefined {
  if (!isRecord(err)) {
    return undefined;
  }
  const { code } = err;
  return typeof code === "string" ? code : undefined;
}

function getErrDetails(err: unknown): Record<string, unknown> | undefined {
  if (!isRecord(err)) {
    return undefined;
  }
  const { details } = err;
  return isRecord(details) ? details : undefined;
}

function getErrCause(err: unknown): unknown {
  if (!isRecord(err)) {
    return undefined;
  }
  return err.cause;
}

export function serializeError(error: unknown, depth = 0): SerializedError {
  const maxDepth = 5;
  if (depth >= maxDepth) {
    return { message: "error_cause_depth_exceeded" };
  }

  if (error instanceof Error) {
    const out: SerializedError = {
      message: error.message || "error",
      name: error.name || undefined,
      stack: typeof error.stack === "string" ? error.stack : undefined,
      code: getErrCode(error),
      details: getErrDetails(error),
    };
    const cause = getErrCause(error);
    if (cause) {
      out.cause = serializeError(cause, depth + 1);
    }
    return out;
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}
