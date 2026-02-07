/**
 * Learning Worker — Maintenance-only polling loop.
 *
 * Handles: confidence decay, low-confidence pruning, archive cleanup,
 * embedding backfill for task_learning nodes.
 *
 * Knowledge extraction from completed runs is handled by the LLM-driven
 * ReflectionObserver in @alfred/pipeline, not here.
 */
import { logger } from "@alfred/logger";

import { processMemoryMaintenance } from "./maintain.js";

export type { LearningWorkerConfig } from "./types.js";

// Re-export domain correction for public API
export { learnDomainCorrection } from "./extract.js";

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  enabled: true,
  decayEnabled: process.env.MEMORY_DECAY_ENABLED !== "false",
  maintenanceIntervalMs: Number.parseInt(
    process.env.MEMORY_DECAY_INTERVAL_MS || "3600000",
    10
  ),
  decayThresholdMs: Number.parseInt(
    process.env.MEMORY_DECAY_THRESHOLD_MS || "86400000",
    10
  ),
  decayFactor: Number.parseFloat(process.env.MEMORY_DECAY_FACTOR || "0.95"),
  pruneConfidence: Number.parseFloat(
    process.env.MEMORY_PRUNE_CONFIDENCE || "0.2"
  ),
  cleanupAgeMs: Number.parseInt(
    process.env.MEMORY_CLEANUP_AGE_MS || "2592000000",
    10
  ),
  decayLimit: 1000,
  confidenceFloor: 0.01,
};

// ── State ───────────────────────────────────────────────────────────────────

let maintenanceInterval: ReturnType<typeof setInterval> | null = null;
let starting = false;

// ── Public API ──────────────────────────────────────────────────────────────

export function startLearningWorker(
  config: Partial<typeof DEFAULT_CONFIG> = {}
) {
  // Guard against concurrent starts and duplicate intervals
  if (maintenanceInterval || starting) {
    return;
  }
  starting = true;

  try {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    if (!finalConfig.enabled) {
      return;
    }

    logger.info("learning_worker_started", {
      mode: "maintenance_only",
      intervalMs: finalConfig.maintenanceIntervalMs,
    });

    const runMaintenance = async () => {
      try {
        if (finalConfig.decayEnabled) {
          await processMemoryMaintenance(finalConfig);
        }
      } catch (error) {
        logger.error("learning_worker_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    // Seed ontology then run first maintenance pass
    void (async () => {
      try {
        const { seedOntology } = await import("./extract.js");
        await seedOntology();
        await runMaintenance();
      } catch (error) {
        logger.error("learning_worker_init_failed", { error: String(error) });
      }
    })();

    maintenanceInterval = setInterval(
      runMaintenance,
      finalConfig.maintenanceIntervalMs
    );
  } finally {
    starting = false;
  }
}

export function stopLearningWorker() {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
}
