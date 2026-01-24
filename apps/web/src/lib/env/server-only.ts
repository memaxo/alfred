/**
 * Server-only environment variable access utilities.
 *
 * These functions use `createServerOnlyFn` to ensure they can only be called
 * on the server. If accidentally called from client code, they will throw
 * a runtime error, preventing server code leakage into client bundles.
 *
 * All environment variable access in server functions should use these utilities
 * instead of direct `process.env` access.
 */
import { createServerOnlyFn } from "@tanstack/react-start";

/**
 * Get DATABASE_URL environment variable (server-only).
 * Throws if called from client code.
 */
export const getDatabaseUrl = createServerOnlyFn(
  () => process.env.DATABASE_URL
);

/**
 * Get NODE_ENV environment variable (server-only).
 * Throws if called from client code.
 */
export const getNodeEnv = createServerOnlyFn(() => process.env.NODE_ENV);

/**
 * Get SCHED_REMIND environment variable (server-only).
 * Used to enable/disable reminder scheduler.
 * Throws if called from client code.
 */
export const getSchedRemind = createServerOnlyFn(
  () => process.env.SCHED_REMIND
);

/**
 * Get SCHED_AGENTFS_CLEANUP environment variable (server-only).
 * Used to enable/disable AgentFS retention cleanup scheduler.
 * Throws if called from client code.
 */
export const getSchedAgentfsCleanup = createServerOnlyFn(
  () => process.env.SCHED_AGENTFS_CLEANUP
);

export const getSchedAgentfsIntegrity = createServerOnlyFn(
  () => process.env.SCHED_AGENTFS_INTEGRITY
);

export const getSchedAgentfsCompact = createServerOnlyFn(
  () => process.env.SCHED_AGENTFS_COMPACT
);

/**
 * Get SCHED_PREFERENCE_INFERENCE environment variable (server-only).
 * Used to enable/disable preference inference scheduler.
 * Throws if called from client code.
 */
export const getSchedPreferenceInference = createServerOnlyFn(
  () => process.env.SCHED_PREFERENCE_INFERENCE
);

/**
 * Get SCHED_PROJECT_LIFECYCLE environment variable (server-only).
 * Used to enable/disable project lifecycle scheduler.
 * Throws if called from client code.
 */
export const getSchedProjectLifecycle = createServerOnlyFn(
  () => process.env.SCHED_PROJECT_LIFECYCLE
);

/**
 * Get SCHED_PATTERN_LIFECYCLE environment variable (server-only).
 * Used to enable/disable pattern lifecycle scheduler.
 * Throws if called from client code.
 */
export const getSchedPatternLifecycle = createServerOnlyFn(
  () => process.env.SCHED_PATTERN_LIFECYCLE
);

/**
 * Get VITE_TEST_MODE environment variable (server-only).
 * Used for test mode detection in server functions.
 * Throws if called from client code.
 */
export const getViteTestMode = createServerOnlyFn(
  () => process.env.VITE_TEST_MODE
);

/**
 * Get MINDSCAPE_TEST environment variable (server-only).
 * Used for Mindscape test mode detection.
 * Throws if called from client code.
 */
export const getMindscapeTest = createServerOnlyFn(
  () => process.env.MINDSCAPE_TEST
);

/**
 * Get BUN_TEST environment variable (server-only).
 * Used for Bun test runner detection.
 * Throws if called from client code.
 */
export const getBunTest = createServerOnlyFn(() => process.env.BUN_TEST);

/**
 * Get SCHED_REEMBED environment variable (server-only).
 * Used to enable/disable re-embedding scheduler for model migration.
 * Throws if called from client code.
 */
export const getSchedReembed = createServerOnlyFn(
  () => process.env.SCHED_REEMBED
);

/**
 * Get EMBED_DEFAULT_MODEL environment variable (server-only).
 * Used to set the default embedding model (kalm or qwen).
 * Defaults to qwen for multimodal support.
 * Throws if called from client code.
 */
export const getEmbedDefaultModel = createServerOnlyFn(
  () => process.env.EMBED_DEFAULT_MODEL
);

/**
 * Get EMBED_EAGER_INIT environment variable (server-only).
 * If set to "1", loads embedding models at startup instead of lazily.
 * Throws if called from client code.
 */
export const getEmbedEagerInit = createServerOnlyFn(
  () => process.env.EMBED_EAGER_INIT
);
