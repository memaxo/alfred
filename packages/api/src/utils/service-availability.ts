/**
 * Type guards and utilities for checking service availability at runtime.
 * Used to gracefully degrade when external services (DB, UV, etc.) are unavailable.
 */

import { accessSync, constants, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "@alfred/db";
import { logger } from "@alfred/logger";

/**
 * Database availability state cache
 */
let dbAvailableCache: boolean | null = null;

/**
 * Check if the database is available and responding.
 * Returns cached result after first check.
 * Use forceCheck=true to bypass cache.
 */
export async function isDbAvailable(forceCheck = false): Promise<boolean> {
  if (dbAvailableCache !== null && !forceCheck) {
    return dbAvailableCache;
  }

  if (!process.env.DATABASE_URL) {
    dbAvailableCache = false;
    return false;
  }

  try {
    // Simple query to check DB connectivity using Drizzle's sql template
    const { sql } = await import("drizzle-orm");
    // Use a real table probe to avoid "DB reachable but schema not ready" false positives.
    // This keeps optional DB-dependent startup tasks quiet unless migrations are applied.
    await db.execute(sql`SELECT 1 FROM cognitive_snapshots LIMIT 1`);
    dbAvailableCache = true;
    return true;
  } catch (error) {
    logger.debug("db_availability_check_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    dbAvailableCache = false;
    return false;
  }
}

/**
 * Reset the cached database availability status.
 * Useful when retrying after DB comes back online.
 */
export function resetDbAvailability(): void {
  dbAvailableCache = null;
}

/**
 * Type guard: Check if database is available
 * Use in conditional checks for type narrowing
 */
export function assertDbAvailable(
  available: boolean
): asserts available is true {
  if (!available) {
    throw new Error("Database is not available");
  }
}

/**
 * Check if UV package manager is available in the system.
 * Checks common installation paths and PATH environment variable.
 */
export function isUvAvailable(): boolean {
  const isExec = (path: string): boolean => {
    try {
      const stat = statSync(path);
      if (!stat.isFile()) {
        return false;
      }
      accessSync(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };

  const canRun = (path: string): boolean => {
    try {
      const proc = Bun.spawnSync([path, "--version"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  };

  // Match the same UV resolution semantics used by the voice subprocess launcher:
  // it selects the first `uv` found on PATH. If that entry is present but not
  // runnable (broken shim / missing interpreter), voice init will fail.
  const envPath = process.env.PATH ?? "";
  if (!envPath) {
    return false;
  }

  const pathDirs = envPath.split(":").filter(Boolean);
  const candidates =
    process.platform === "win32"
      ? ["uv.exe", "uv.cmd", "uv.bat", "uv"]
      : ["uv"];

  for (const dir of pathDirs) {
    for (const name of candidates) {
      const candidate = join(dir, name);
      if (!isExec(candidate)) {
        continue;
      }
      return canRun(candidate);
    }
  }

  return false;
}

/**
 * Type guard: Check if UV is available
 */
export function assertUvAvailable(
  available: boolean
): asserts available is true {
  if (!available) {
    throw new Error("UV package manager is not available");
  }
}

/**
 * Check if a service error is a database connection error.
 * Used to determine if we should gracefully degrade.
 */
export function isDbConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("password authentication failed") ||
    message.includes("connection refused") ||
    message.includes("database") ||
    message.includes("failed query") ||
    message.includes("connection terminated")
  );
}

/**
 * Check if a service error is a transient error that might be retryable.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("temporary") ||
    message.includes("retry")
  );
}
