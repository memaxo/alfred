/**
 * Isolated spawn wrapper using poof for ephemeral filesystem isolation.
 *
 * Wraps Bun.spawn to prefix commands with poof, providing:
 * - Ephemeral execution (changes vanish)
 * - Reviewable changes (captured in upper layer)
 * - Resource limits (memory, PIDs, timeout)
 */

import { spawn } from "bun";
import { rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  type PoofMode,
  type PoofProfile,
  POOF_PROFILES,
  buildPoofArgs,
  getPoofBinary,
  isPoofAvailable,
  isPoofTimeout,
  isCommandNotFound,
} from "./poof.js";
import type { PoofChange } from "./diff.js";
import { parseUpperLayer } from "./diff.js";

/** Options for isolated spawn */
export interface IsolatedSpawnOptions {
  /** Poof mode: exec (ephemeral) or run (reviewable) */
  mode: PoofMode;
  /** Directory for capturing changes (required for run mode review) */
  upperDir?: string;
  /** Resource profile */
  profile?: PoofProfile;
  /** Working directory for the command */
  cwd: string;
  /** Command and arguments */
  command: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Enable verbose poof output */
  verbose?: boolean;
  /** Collect stdout */
  captureStdout?: boolean;
  /** Collect stderr */
  captureStderr?: boolean;
}

/** Result from isolated spawn */
export interface IsolatedSpawnResult {
  /** Process exit code */
  exitCode: number;
  /** Upper directory containing changes (if mode='run') */
  upperDir?: string;
  /** Whether the process timed out */
  timedOut: boolean;
  /** Whether the command was not found */
  commandNotFound: boolean;
  /** Changes detected in upper layer (if mode='run' and parseChanges=true) */
  changes?: PoofChange[];
  /** Captured stdout */
  stdout?: string;
  /** Captured stderr */
  stderr?: string;
}

/**
 * Spawn a command inside poof isolation.
 *
 * In 'exec' mode, all filesystem changes vanish when the command exits.
 * In 'run' mode, changes are captured in the upper directory for review.
 */
export async function spawnIsolated(
  options: IsolatedSpawnOptions
): Promise<IsolatedSpawnResult> {
  if (!isPoofAvailable()) {
    throw new Error("poof_not_available");
  }

  const poofBinary = getPoofBinary();

  // For run mode, ensure we have an upper directory
  let upperDir = options.upperDir;
  let createdUpperDir = false;

  if (options.mode === "run" && !upperDir) {
    // Create a temporary upper directory
    const prefix = path.join(tmpdir(), "poof-upper-");
    upperDir = await mkdtemp(prefix);
    createdUpperDir = true;
  }

  // Build poof arguments
  const poofArgs = buildPoofArgs({
    mode: options.mode,
    upperDir,
    profile: options.profile ?? POOF_PROFILES.standard,
    verbose: options.verbose,
  });

  // Full command: poof <mode> [options] -- <command> [args...]
  const fullCommand = [poofBinary, ...poofArgs, "--", ...options.command];

  // Merge environment
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      env[key] = value;
    }
  }

  // Spawn the process
  const proc = spawn(fullCommand, {
    cwd: options.cwd,
    env,
    stdout: options.captureStdout ? "pipe" : "inherit",
    stderr: options.captureStderr ? "pipe" : "inherit",
    stdin: "inherit",
  });

  // Capture output if requested
  let stdout: string | undefined;
  let stderr: string | undefined;

  if (options.captureStdout && proc.stdout) {
    stdout = await new Response(proc.stdout).text();
  }

  if (options.captureStderr && proc.stderr) {
    stderr = await new Response(proc.stderr).text();
  }

  // Wait for exit
  const exitCode = await proc.exited;

  const timedOut = isPoofTimeout(exitCode);
  const commandNotFound = isCommandNotFound(exitCode);

  // Parse changes if in run mode
  let changes: PoofChange[] | undefined;
  if (options.mode === "run" && upperDir && !timedOut && !commandNotFound) {
    try {
      changes = await parseUpperLayer(upperDir, options.cwd);
    } catch {
      // Ignore parse errors
    }
  }

  // Clean up temporary upper directory on failure or exec mode
  if (
    createdUpperDir &&
    upperDir &&
    (options.mode === "exec" || timedOut || commandNotFound)
  ) {
    try {
      rmSync(upperDir, { recursive: true, force: true });
      upperDir = undefined;
    } catch {
      // Ignore cleanup errors
    }
  }

  return {
    exitCode,
    upperDir: options.mode === "run" ? upperDir : undefined,
    timedOut,
    commandNotFound,
    changes,
    stdout,
    stderr,
  };
}

/**
 * Run a command in ephemeral mode (changes vanish).
 */
export async function spawnEphemeral(
  command: string[],
  cwd: string,
  options?: {
    profile?: PoofProfile;
    env?: Record<string, string>;
    captureStdout?: boolean;
    captureStderr?: boolean;
  }
): Promise<IsolatedSpawnResult> {
  return spawnIsolated({
    mode: "exec",
    command,
    cwd,
    ...options,
  });
}

/**
 * Run a command in reviewable mode (changes captured).
 */
export async function spawnReviewable(
  command: string[],
  cwd: string,
  options?: {
    upperDir?: string;
    profile?: PoofProfile;
    env?: Record<string, string>;
    captureStdout?: boolean;
    captureStderr?: boolean;
  }
): Promise<IsolatedSpawnResult> {
  return spawnIsolated({
    mode: "run",
    command,
    cwd,
    ...options,
  });
}

/**
 * Create a managed upper directory for poof run mode.
 */
export async function createUpperDir(prefix?: string): Promise<string> {
  const basePrefix = prefix ?? path.join(tmpdir(), "poof-upper-");
  return mkdtemp(basePrefix);
}

/**
 * Clean up an upper directory.
 */
export function cleanupUpperDir(upperDir: string): void {
  rmSync(upperDir, { recursive: true, force: true });
}
