/**
 * Poof ephemeral filesystem isolation types and utilities.
 *
 * Poof uses Linux overlayfs and namespaces to isolate filesystem changes.
 * Changes can either vanish (exec mode) or be captured for review (run mode).
 */

import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";

/** Poof execution mode */
export type PoofMode = "exec" | "run";

/** Resource profile for poof isolation */
export type PoofProfile = {
  name: string;
  memory?: string; // e.g., "256M", "1G", "4G"
  pids?: number; // Fork bomb protection
  timeout?: number; // Seconds
};

/** Predefined resource profiles */
export const POOF_PROFILES = {
  minimal: {
    name: "minimal",
    memory: "256M",
    pids: 20,
    timeout: 60,
  },
  standard: {
    name: "standard",
    memory: "1G",
    pids: 100,
    timeout: 300,
  },
  intensive: {
    name: "intensive",
    memory: "4G",
    pids: 500,
    timeout: 600,
  },
} as const satisfies Record<string, PoofProfile>;

export type PoofProfileName = keyof typeof POOF_PROFILES;

/** Special exit codes from poof */
export const POOF_EXIT_CODES = {
  TIMEOUT: 124,
  NOT_FOUND: 127,
} as const;

/** Environment variable set inside poof sandbox */
export const POOF_SANDBOX_ENV = "IS_SANDBOX";

/** Environment variable to override poof binary path */
const POOF_BIN_ENV = "POOF_BIN";

/** Cached availability result */
let cachedAvailability: boolean | null = null;
let cachedBinaryPath: string | null = null;

/**
 * Resolve the poof binary path.
 *
 * Checks POOF_BIN env var first, then searches PATH.
 * Returns null if poof is not found.
 */
export function resolvePoofBinary(): string | null {
  if (cachedBinaryPath !== null) {
    return cachedBinaryPath;
  }

  // Check override env var
  const override = process.env[POOF_BIN_ENV]?.trim();
  if (override) {
    try {
      accessSync(override, fsConstants.X_OK);
      cachedBinaryPath = override;
      return override;
    } catch {
      // Override specified but not executable
      return null;
    }
  }

  // Search PATH
  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, "poof");
    try {
      accessSync(candidate, fsConstants.X_OK);
      cachedBinaryPath = candidate;
      return candidate;
    } catch {
      // Continue searching
    }
  }

  return null;
}

/**
 * Check if poof is available on this system.
 *
 * Poof only works on Linux. Returns false on other platforms
 * or if the poof binary is not found.
 */
export function isPoofAvailable(): boolean {
  if (cachedAvailability !== null) {
    return cachedAvailability;
  }

  // Poof only works on Linux
  if (process.platform !== "linux") {
    cachedAvailability = false;
    return false;
  }

  const binary = resolvePoofBinary();
  cachedAvailability = binary !== null;
  return cachedAvailability;
}

/**
 * Get the poof binary path, throwing if not available.
 */
export function getPoofBinary(): string {
  const binary = resolvePoofBinary();
  if (!binary) {
    throw new Error("poof_binary_not_found");
  }
  return binary;
}

/**
 * Reset cached availability (for testing).
 */
export function resetPoofCache(): void {
  cachedAvailability = null;
  cachedBinaryPath = null;
}

/**
 * Build poof command arguments from options.
 */
export function buildPoofArgs(options: {
  mode: PoofMode;
  upperDir?: string;
  profile?: PoofProfile;
  verbose?: boolean;
}): string[] {
  const args: string[] = [options.mode];

  if (options.upperDir) {
    args.push(`--upper=${options.upperDir}`);
  }

  if (options.profile?.memory) {
    args.push(`--memory=${options.profile.memory}`);
  }

  if (options.profile?.pids) {
    args.push(`--pids=${options.profile.pids}`);
  }

  if (options.profile?.timeout) {
    args.push(`--timeout=${options.profile.timeout}`);
  }

  if (options.verbose) {
    args.push("--verbose");
  }

  return args;
}

/**
 * Check if an exit code indicates a poof timeout.
 */
export function isPoofTimeout(exitCode: number): boolean {
  return exitCode === POOF_EXIT_CODES.TIMEOUT;
}

/**
 * Check if an exit code indicates command not found.
 */
export function isCommandNotFound(exitCode: number): boolean {
  return exitCode === POOF_EXIT_CODES.NOT_FOUND;
}

/**
 * Check if running inside a poof sandbox.
 */
export function isInsideSandbox(): boolean {
  return process.env[POOF_SANDBOX_ENV] === "1";
}
