#!/usr/bin/env bun
import { spawn } from "bun";

const DEFAULT_PATTERNS = [/^ws-/, /^verify-session-/];

class TmuxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TmuxUnavailableError";
  }
}

type ListHandler = () => Promise<string[]>;

async function listSessionsViaTmux(): Promise<string[]> {
  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn(["tmux", "list-sessions", "-F", "#{session_name}"], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    throw new TmuxUnavailableError(
      (error as Error)?.message ?? "tmux_binary_missing"
    );
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited,
  ]);

  if (exitCode === 0) {
    return stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const message = stderr || stdout;
  if (
    exitCode === 1 &&
    (message.includes("failed to connect") ||
      message.toLowerCase().includes("no server running") ||
      message.toLowerCase().includes("no such file or directory"))
  ) {
    return [];
  }

  throw new Error(`tmux_list_failed: ${message || "unknown error"}`);
}

let listHandler: ListHandler = listSessionsViaTmux;

export const __internals = {
  setListHandler(handler: ListHandler) {
    listHandler = handler;
  },
  resetListHandler() {
    listHandler = listSessionsViaTmux;
  },
  TmuxUnavailableError,
};

export async function collectTmuxSessions(): Promise<string[]> {
  return await listHandler();
}

type CheckOptions = {
  patterns?: RegExp[];
  strict?: boolean;
  quiet?: boolean;
};

export async function checkTmuxLeaks(
  options?: CheckOptions
): Promise<string[]> {
  let sessions: string[];
  try {
    sessions = await collectTmuxSessions();
  } catch (error) {
    if (error instanceof TmuxUnavailableError) {
      if (options?.strict) {
        throw error;
      }
      console.log(
        "[check-tmux-leaks] tmux unavailable; skipping leak detection."
      );
      return [];
    }
    throw error;
  }

  const patterns = options?.patterns ?? DEFAULT_PATTERNS;
  const leaks = sessions.filter((session) =>
    patterns.some((pattern) => pattern.test(session))
  );

  if (leaks.length > 0) {
    throw new Error(
      `tmux_session_leak_detected: ${leaks
        .map((entry) => `"${entry}"`)
        .join(", ")}`
    );
  }

  if (!options?.quiet) {
    console.log("[check-tmux-leaks] No leaked workspace sessions detected.");
  }

  return [];
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  try {
    await checkTmuxLeaks({ strict });
  } catch (error) {
    console.error("[check-tmux-leaks] FAILURE:", error);
    process.exitCode = 1;
  }
}
