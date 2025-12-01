/**
 * Shared subprocess utilities for tool execution
 *
 * Provides consistent handling of process spawning, output streaming,
 * and timeout management across tools (Codex, Droid, etc.).
 */

import {
  accessSync,
  constants as fsConstants,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";

// Time constants
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const BYTES_PER_KIBIBYTE = 1024;
const MS_PER_SECOND = 1000;
const DEFAULT_TIMEOUT_MINUTES = 30;
const MIN_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_HOURS = 2;
const OUTPUT_CAP_MEBIBYTES = 5;

/** Default timeout for tool execution (30 minutes) */
export const DEFAULT_TIMEOUT_SEC = DEFAULT_TIMEOUT_MINUTES * SECONDS_PER_MINUTE;
/** Minimum allowed timeout (30 seconds) */
export const MIN_TIMEOUT_SEC = MIN_TIMEOUT_SECONDS;
/** Maximum allowed timeout (2 hours) */
export const MAX_TIMEOUT_SEC =
  MAX_TIMEOUT_HOURS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
/** Default output capture limit (5 MiB) */
export const OUTPUT_CAP_BYTES =
  OUTPUT_CAP_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;

/**
 * Get allowed directory prefixes from environment
 * Computed once at module load time
 */
export const DEFAULT_ALLOW_PREFIXES = (() => {
  const base = realpathSync(process.cwd());
  const raw = process.env.ORCH_ALLOW_CWD_PREFIXES;
  const extras =
    raw && raw.trim().length > 0
      ? raw
          .split(path.delimiter)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  const prefixes = new Set<string>([base]);

  for (const entry of extras) {
    try {
      const absolute = path.isAbsolute(entry)
        ? entry
        : path.resolve(base, entry);
      prefixes.add(realpathSync(absolute));
    } catch {
      // Ignore invalid entries so that a malformed env var does not break execution.
    }
  }

  return Array.from(prefixes);
})();

/**
 * Safely resolve a path to its real path, returning null on failure
 */
export function safeRealpath(candidate: string): string | null {
  try {
    return realpathSync(candidate);
  } catch {
    return null;
  }
}

/**
 * Check if target path is within base directory
 */
export function isWithinBase(base: string, target: string): boolean {
  const baseReal = safeRealpath(base);
  const targetReal = safeRealpath(target);
  if (!(baseReal && targetReal)) {
    return false;
  }
  const relative = path.relative(baseReal, targetReal);
  return (
    relative === "" || !(relative.startsWith("..") || path.isAbsolute(relative))
  );
}

/**
 * Assert that a directory is within allowed prefixes
 *
 * @param candidate - Path to validate
 * @param errorPrefix - Prefix for error messages (e.g., "codex", "droid")
 * @returns Resolved real path
 * @throws Error if directory is not allowed
 */
export function assertAllowedDirectory(
  candidate: string,
  errorPrefix: string
): string {
  const resolved = safeRealpath(candidate);
  if (!resolved) {
    throw new Error(`${errorPrefix}_invalid_cwd`);
  }
  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, resolved)) {
      const stats = statSync(resolved);
      if (!stats.isDirectory()) {
        throw new Error(`${errorPrefix}_invalid_cwd_not_directory`);
      }
      return resolved;
    }
  }
  throw new Error(`${errorPrefix}_invalid_cwd`);
}

/**
 * Resolve an executable command to its absolute path
 *
 * @param command - Command name or path
 * @param errorPrefix - Prefix for error messages (e.g., "codex", "droid")
 * @returns Absolute path to executable
 * @throws Error if executable not found
 */
export function resolveExecutable(
  command: string,
  errorPrefix: string
): string {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue searching
    }
  }

  throw new Error(`${errorPrefix}_binary_not_found`);
}

/**
 * Output accumulator for capturing stdout/stderr
 */
export type OutputAccumulator = {
  chunks: string[];
  storedBytes: number;
  truncated: boolean;
};

/**
 * Create a fresh output accumulator
 */
export function createOutputAccumulator(): OutputAccumulator {
  return {
    chunks: [],
    storedBytes: 0,
    truncated: false,
  };
}

/**
 * Append output to accumulator with byte limit enforcement
 *
 * @param acc - The output accumulator
 * @param chunk - Text chunk to append
 * @param capBytes - Optional byte cap (defaults to OUTPUT_CAP_BYTES)
 */
export function appendOutput(
  acc: OutputAccumulator,
  chunk: string,
  capBytes = OUTPUT_CAP_BYTES
): void {
  if (!chunk) {
    return;
  }

  const buffer = Buffer.from(chunk);
  if (acc.truncated) {
    acc.storedBytes += buffer.byteLength;
    return;
  }

  const remaining = capBytes - acc.storedBytes;
  if (remaining <= 0) {
    acc.truncated = true;
    return;
  }

  if (buffer.byteLength <= remaining) {
    acc.chunks.push(chunk);
    acc.storedBytes += buffer.byteLength;
    return;
  }

  acc.chunks.push(buffer.subarray(0, remaining).toString());
  acc.storedBytes += remaining;
  acc.truncated = true;
}

/**
 * Get accumulated output as a single string
 */
export function getAccumulatedOutput(acc: OutputAccumulator): string {
  return acc.chunks.join("\n").trim();
}

/** Writer interface for streaming tool output */
export type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

/**
 * Timeout context for managing subprocess timeout
 */
export type TimeoutContext = {
  timer: ReturnType<typeof setNodeTimeout>;
  didTimeout: boolean;
  clear: () => void;
};

/**
 * Create a timeout context for subprocess execution
 *
 * @param proc - Bun subprocess to kill on timeout
 * @param timeoutSec - Timeout in seconds
 * @param writer - Optional writer for timeout notification
 * @param noticeMessage - Message for timeout notice (e.g., "codex_exec_timeout")
 * @returns TimeoutContext with timer and cleanup function
 */
export function createTimeout(
  proc: { kill: (signal?: number | NodeJS.Signals) => void },
  timeoutSec: number,
  writer: ToolWriter,
  noticeMessage: string
): TimeoutContext {
  const ctx: TimeoutContext = {
    timer: null as unknown as ReturnType<typeof setNodeTimeout>,
    didTimeout: false,
    clear: () => {
      clearNodeTimeout(ctx.timer);
    },
  };

  ctx.timer = setNodeTimeout(() => {
    ctx.didTimeout = true;
    try {
      proc.kill("SIGKILL");
    } catch {
      // ignore errors when killing the process
    }
    // biome-ignore lint/complexity/noVoid: fire-and-forget pattern
    void Promise.resolve(
      writer?.write?.({
        type: "notice",
        message: noticeMessage,
      })
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional error suppression
    ).catch(() => {});
  }, timeoutSec * MS_PER_SECOND);

  return ctx;
}

/**
 * Stream stderr from a subprocess to a writer
 *
 * @param proc - Bun subprocess with stderr pipe
 * @param writer - Writer for stderr chunks
 */
export function streamStderr(
  proc: { stderr: ReadableStream<Uint8Array> | number | null },
  writer: ToolWriter
): void {
  if (!proc.stderr || typeof proc.stderr === "number") {
    return;
  }

  const reader = proc.stderr.getReader();
  const decoder = new TextDecoder();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        // biome-ignore lint/complexity/noVoid: fire-and-forget pattern
        void Promise.resolve(
          writer?.write?.({ type: "stderr", text: decoder.decode(value) })
          // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional error suppression
        ).catch(() => {});
      }
    } catch {
      // Ignore stderr read errors
    }
  })();
}
