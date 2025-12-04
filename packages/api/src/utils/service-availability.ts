/**
 * Type guards and utilities for checking service availability at runtime.
 * Used to gracefully degrade when external services (DB, UV, etc.) are unavailable.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
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

  try {
    // Simple query to check DB connectivity using Drizzle's sql template
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
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
  // Check common UV installation paths
  const uvPaths = [
    join(homedir(), ".local/bin/uv"),
    join(homedir(), ".cargo/bin/uv"),
    "/usr/local/bin/uv",
    "/usr/bin/uv",
  ];

  // Also check if UV is in PATH
  const envPath = process.env.PATH ?? "";
  const pathDirs = envPath.split(":");

  for (const path of uvPaths) {
    if (existsSync(path)) {
      return true;
    }
  }

  // Check PATH directories for uv binary
  for (const dir of pathDirs) {
    if (existsSync(join(dir, "uv"))) {
      return true;
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
