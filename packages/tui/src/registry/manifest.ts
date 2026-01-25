/**
 * CLI Manifest Types
 *
 * Every ALFRED package can export a CliManifest to register its
 * CLI commands, TUI panels, and health checks with the central registry.
 */

import type { z } from "zod";

// ─── Health Status ────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

// ─── Command Definition ───────────────────────────────────────────────────────

export interface CommandDef {
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
}

// ─── TUI Panel Definition ─────────────────────────────────────────────────────

export interface TuiPanelDef {
  /** Unique panel identifier */
  id: string;
  /** Display name in TUI */
  name: string;
  /** Short description */
  description?: string;
  /** Keyboard shortcut to focus panel */
  shortcut?: string;
  /** Panel factory function (lazy-loaded) */
  factory: () => Promise<unknown>;
  /** Panel category for organization */
  category?: "monitoring" | "admin" | "debug" | "data";
  /** Default visibility in dashboard */
  defaultVisible?: boolean;
}

// ─── Shortcut Definition ──────────────────────────────────────────────────────

export interface ShortcutDef {
  /** Key combination (e.g., "Ctrl+Shift+V") */
  keys: string;
  /** Action description */
  description: string;
  /** Handler function */
  handler: () => void | Promise<void>;
  /** Context where shortcut is active */
  context?: "global" | "panel" | "modal";
}

// ─── Subscription Definition ──────────────────────────────────────────────────

export interface SubscriptionDef {
  /** Subscription identifier */
  id: string;
  /** tRPC subscription path (e.g., "cognitive.state") */
  path: string;
  /** Description for documentation */
  description?: string;
}

// ─── CLI Manifest ─────────────────────────────────────────────────────────────

/**
 * Package manifest for CLI/TUI integration.
 *
 * Packages export this from `src/cli.ts` or `src/manifest.ts` to register
 * their capabilities with the TUI package registry.
 *
 * @example
 * ```typescript
 * // packages/voice/src/manifest.ts
 * export const manifest: CliManifest = {
 *   name: "@alfred/voice",
 *   version: "0.0.1",
 *   description: "Voice processing (STT/TTS)",
 *   commands: [
 *     { name: "test-stt", description: "Test STT", handler: testSTT },
 *   ],
 *   panels: [
 *     { id: "voice", name: "Voice Pipeline", factory: () => import("./panel") },
 *   ],
 *   healthCheck: async () => ({ status: "healthy" }),
 * };
 * ```
 */
export interface CliManifest {
  /** Package name (e.g., "@alfred/voice") */
  name: string;
  /** Package version */
  version: string;
  /** Human-readable description */
  description: string;

  /** Direct CLI commands (non-tRPC) */
  commands?: CommandDef[];

  /** TUI panels provided by this package */
  panels?: TuiPanelDef[];

  /** Keyboard shortcuts */
  shortcuts?: ShortcutDef[];

  /** tRPC subscriptions for real-time data */
  subscriptions?: SubscriptionDef[];

  /** Health check function for status display */
  healthCheck?: () => Promise<HealthStatus>;

  /** Dependencies on other packages (for load order) */
  dependencies?: string[];
}

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

// ─── Package Info ─────────────────────────────────────────────────────────────

/**
 * Minimal package info for discovery
 */
export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  hasManifest: boolean;
}

/**
 * Registered package with resolved manifest
 */
export type RegisteredPackage = PackageInfo & {
  manifest: CliManifest;
  loadedAt: Date;
};
