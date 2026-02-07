/**
 * Memory maintenance — decay, pruning, archive cleanup, embedding backfill.
 */
import { db } from "@alfred/db";
import {
  archiveNodes,
  deleteArchivedNodes,
  findNodesByConfidence,
  findNodesForDecay,
  updateNodeConfidenceBatch,
  updateNodeEmbeddingBatch,
} from "@alfred/db/repo/graph/index";
import { memoryNodes } from "@alfred/db/schema/graph";
import { SEED_CONFIDENCE } from "@alfred/knowledge/ontology";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { LearningWorkerConfig } from "./types.js";

// Mock metrics if package not available
const mockHistogram = { startTimer: () => () => {} };
const mockCounter = { inc: (_value?: number) => {} };

let metrics = {
  memoryMaintenanceDurationSeconds: mockHistogram,
  memoryNodesDecayedTotal: mockCounter,
  memoryNodesPrunedTotal: mockCounter,
  memoryNodesCleanedTotal: mockCounter,
};

void (async () => {
  try {
    const sharedMetrics = await import("@alfred/metrics/shared");
    if (sharedMetrics.memoryMaintenanceDurationSeconds) {
      metrics = sharedMetrics;
    }
  } catch {
    // Metrics not available — use mocks
  }
})();

const EMBEDDING_BACKFILL_BATCH = 20;

// ── Public ──────────────────────────────────────────────────────────────────

export async function processMemoryMaintenance(config: LearningWorkerConfig) {
  logger.debug("learning_worker_maintenance_started");
  const stopTimer = metrics.memoryMaintenanceDurationSeconds.startTimer();

  try {
    await decayStaleNodes(config);
    await decayArchivedProjectNodes(config);
    await pruneLowConfidenceNodes(config);
    await cleanupArchivedNodes(config);
    await decaySeedNodesWithLearnedOverrides(config);
    await embedUnembeddedNodes();
  } catch (error) {
    logger.warn("learning_worker_maintenance_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    stopTimer();
  }
}

// ── Internal ────────────────────────────────────────────────────────────────

async function decayStaleNodes(config: LearningWorkerConfig) {
  const staleNodes = await findNodesForDecay(
    config.decayThresholdMs,
    config.decayLimit
  );
  if (staleNodes.length === 0) {
    return;
  }

  const updates = staleNodes.map((node) => {
    const props = (node.properties as Record<string, unknown>) || {};
    const currentConfidence =
      typeof props.confidence === "number" ? props.confidence : 1;
    const newConfidence = Math.max(
      config.confidenceFloor,
      currentConfidence * config.decayFactor
    );
    return { id: node.id, confidence: newConfidence };
  });

  const decayedCount = await updateNodeConfidenceBatch(updates);
  metrics.memoryNodesDecayedTotal.inc(decayedCount);
  logger.info("learning_worker_decayed", { count: decayedCount });
}

async function decayArchivedProjectNodes(config: LearningWorkerConfig) {
  const archivedProjectIds = await (async () => {
    const url = process.env.DATABASE_URL;
    if (!url || url.startsWith("sqlite")) {
      return [] as string[];
    }
    try {
      const projectRepo = await import("@alfred/db/repo/project");
      return await projectRepo.listArchivedProjectIds(200);
    } catch {
      return [] as string[];
    }
  })();

  if (archivedProjectIds.length === 0) {
    return;
  }

  const archivedNodes = await findNodesForDecay(
    config.decayThresholdMs,
    config.decayLimit,
    archivedProjectIds
  );

  if (archivedNodes.length === 0) {
    return;
  }

  const updates = archivedNodes.map((node) => {
    const props = (node.properties as Record<string, unknown>) || {};
    const currentConfidence =
      typeof props.confidence === "number" ? props.confidence : 1;
    const newConfidence = Math.max(
      config.confidenceFloor,
      currentConfidence * config.decayFactor * 0.9
    );
    return { id: node.id, confidence: newConfidence };
  });

  const decayedCount = await updateNodeConfidenceBatch(updates);
  metrics.memoryNodesDecayedTotal.inc(decayedCount);
  logger.info("learning_worker_archived_project_decay", {
    count: decayedCount,
  });
}

async function pruneLowConfidenceNodes(config: LearningWorkerConfig) {
  const lowConfidenceNodes = await findNodesByConfidence(
    0,
    config.pruneConfidence,
    undefined,
    100
  );
  if (lowConfidenceNodes.length === 0) {
    return;
  }

  const ids = lowConfidenceNodes.map((n) => n.id);
  const prunedCount = await archiveNodes(ids, "low_confidence");
  metrics.memoryNodesPrunedTotal.inc(prunedCount);
  logger.info("learning_worker_pruned", { count: prunedCount });
}

async function cleanupArchivedNodes(config: LearningWorkerConfig) {
  const deletedCount = await deleteArchivedNodes(config.cleanupAgeMs);
  if (deletedCount > 0) {
    metrics.memoryNodesCleanedTotal.inc(deletedCount);
    logger.info("learning_worker_cleanup", { count: deletedCount });
  }
}

async function decaySeedNodesWithLearnedOverrides(
  config: LearningWorkerConfig
): Promise<void> {
  try {
    const seedNodes = await db
      .select()
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.kind, "domain_association"),
          sql`${memoryNodes.properties}->>'source' = 'seed'`,
          sql`(${memoryNodes.properties}->>'confidence')::numeric > ${config.confidenceFloor}`
        )
      )
      .limit(100);

    if (seedNodes.length === 0) {
      return;
    }

    const updates: { id: string; confidence: number }[] = [];

    for (const seedNode of seedNodes) {
      const props = (seedNode.properties as Record<string, unknown>) || {};
      const seedDomain = props.domain;
      const seedConfidence =
        typeof props.confidence === "number"
          ? props.confidence
          : SEED_CONFIDENCE;

      if (!seedDomain) {
        continue;
      }

      const learnedNodes = await db
        .select()
        .from(memoryNodes)
        .where(
          and(
            eq(memoryNodes.kind, "domain_association"),
            sql`${memoryNodes.properties}->>'source' IN ('correction', 'learned')`,
            sql`${memoryNodes.properties}->>'domain' = ${seedDomain}`,
            sql`(${memoryNodes.properties}->>'confidence')::numeric > ${seedConfidence}`
          )
        )
        .limit(1);

      if (learnedNodes.length > 0) {
        const newConfidence = Math.max(
          config.confidenceFloor,
          seedConfidence * config.decayFactor * 0.5
        );
        updates.push({ id: seedNode.id, confidence: newConfidence });
      }
    }

    if (updates.length > 0) {
      const decayedCount = await updateNodeConfidenceBatch(updates);
      logger.info("learning_worker_seed_decay", { count: decayedCount });
    }
  } catch (error) {
    logger.warn("learning_worker_seed_decay_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Backfill embeddings for task_learning nodes that were created without them.
 * This enables vector similarity search for task learnings in enrichment queries.
 */
async function embedUnembeddedNodes(): Promise<void> {
  try {
    const nodes = await db
      .select({ id: memoryNodes.id, label: memoryNodes.label })
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.kind, "task_learning"),
          isNull(memoryNodes.embedding)
        )
      )
      .limit(EMBEDDING_BACKFILL_BATCH);

    if (nodes.length === 0) {
      return;
    }

    const labels = nodes.map((n) => n.label);
    let embeddings: number[][] = [];
    try {
      embeddings = await embedMany(labels);
    } catch (error) {
      logger.warn("learning_worker_embed_backfill_failed", {
        error: error instanceof Error ? error.message : String(error),
        count: nodes.length,
      });
      return;
    }

    // Build batch payload, skipping empty embeddings
    const batch: { id: string; embedding: number[] }[] = [];
    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes.at(idx);
      const emb = embeddings.at(idx);
      if (node && emb && emb.length > 0) {
        batch.push({ id: node.id, embedding: emb });
      }
    }

    if (batch.length > 0) {
      const updated = await updateNodeEmbeddingBatch(batch);
      logger.info("learning_worker_embed_backfill", { count: updated });
      try {
        const { reflectionLearningsBackfilledTotal } =
          await import("@alfred/metrics/enrichment");
        reflectionLearningsBackfilledTotal.inc(updated);
      } catch {
        // Metrics package not available
      }
    }
  } catch (error) {
    logger.warn("learning_worker_embed_backfill_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
