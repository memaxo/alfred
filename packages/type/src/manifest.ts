/**
 * CLI Manifest Types (Standalone)
 *
 * This file is exported separately so packages can import without
 * depending on @alfred/tui.
 */

import type { z } from "zod";

// ─── Health Status ────────────────────────────────────────────────────────────

export type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

// ─── Command Definition ───────────────────────────────────────────────────────

export type CommandDef = {
  /** Command name (e.g., "test-stt", "migrate") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for command arguments */
  args?: z.ZodType<unknown>;
  /** Command handler function */
  handler: (args: unknown) => Promise<void>;
  /** Category for grouping in help output */
  category?: string;
  /** Whether command requires authentication */
  requiresAuth?: boolean;
  /** Whether command requires biometric elevation */
  requiresBiometric?: boolean;
};

// ─── CLI Manifest (Minimal - No TUI dependencies) ────────────────────────────

/**
 * Package manifest for CLI integration (without TUI panel dependencies).
 *
 * Packages export this from `src/manifest.ts` to register commands and health checks.
 */
export type CliManifest = {
  /** Package name (e.g., "@alfred/voice") */
  name: string;
  /** Package version */
  version: string;
  /** Human-readable description */
  description: string;

  /** Direct CLI commands */
  commands?: CommandDef[];

  /** Health check function for status display */
  healthCheck?: () => Promise<HealthStatus>;

  /** Dependencies on other packages (for load order) */
  dependencies?: string[];
};

// ─── Manifest Validation ──────────────────────────────────────────────────────

/**
 * Validate a manifest object has required fields
 */
export function isValidManifest(obj: unknown): obj is CliManifest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const manifest = obj as Record<string, unknown>;

  return (
    typeof manifest.name === "string" &&
    typeof manifest.version === "string" &&
    typeof manifest.description === "string"
  );
}
