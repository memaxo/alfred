import { createHash } from "node:crypto";
import { db } from "@alfred/db";
import {
  archiveNodes,
  deleteArchivedNodes,
  findNodesByConfidence,
  findNodesForDecay,
  updateNodeConfidenceBatch,
  upsertEdges,
  upsertNodes,
} from "@alfred/db/repo/graph/index";
import { memoryNodes } from "@alfred/db/schema/graph";
import { workflowRuns } from "@alfred/db/schema/workflow";
import { extract, toKnowledge } from "@alfred/knowledge/extractor";
import { knowledgeHash } from "@alfred/knowledge/hypergraph";
import {
  getOntologyKnowledge,
  SEED_CONFIDENCE,
} from "@alfred/knowledge/ontology";
import { deriveAlternativeFacts } from "@alfred/knowledge/reasoning/alternatives";
import { deriveCausalityFromText } from "@alfred/knowledge/reasoning/causality";
import { deriveDecisionFacts } from "@alfred/knowledge/reasoning/decisions";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

// Mock metrics if package not available (for tests or circular dep avoidance)
const mockHistogram = { startTimer: () => () => {} };
const mockCounter = { inc: (_value?: number) => {} };

let metrics = {
  memoryMaintenanceDurationSeconds: mockHistogram,
  memoryNodesDecayedTotal: mockCounter,
  memoryNodesPrunedTotal: mockCounter,
  memoryNodesCleanedTotal: mockCounter,
};

// Lazy load metrics to avoid circular dependencies during initialization
const loadMetrics = async () => {
  // We cannot check process.env.NODE_ENV === 'test' reliably here because Bun test runner
  // might not set it consistently across all environments, or we might WANT to test metrics.
  // Instead, we wrap the import in a try/catch block which is sufficient safety.
  try {
    const sharedMetrics = await import("@alfred/metrics/shared");
    if (sharedMetrics.memoryMaintenanceDurationSeconds) {
      metrics = sharedMetrics;
    }
  } catch {
    // Keep mocks
  }
};
void loadMetrics();

/**
 * Constant Background Learning Worker
 * Polls for completed workflow runs and extracts knowledge into the graph.
 * Also handles memory maintenance (decay, pruning, cleanup).
 */

export type LearningWorkerConfig = {
  intervalMs: number;
  enabled: boolean;
  batchSize: number;
  // Memory Maintenance (Decay)
  decayEnabled: boolean;
  maintenanceIntervalMs: number;
  decayThresholdMs: number;
  decayFactor: number;
  pruneConfidence: number;
  cleanupAgeMs: number;
  decayLimit: number;
  confidenceFloor: number;
  // Episodic Dreaming
  dreamingEnabled: boolean;
  dreamingIntervalMs: number;
};

const DEFAULT_CONFIG: LearningWorkerConfig = {
  intervalMs: 10_000, // Poll every 10s
  enabled: true,
  batchSize: 5,
  // Memory Maintenance
  decayEnabled: process.env.MEMORY_DECAY_ENABLED !== "false",
  maintenanceIntervalMs: Number.parseInt(
    process.env.MEMORY_DECAY_INTERVAL_MS || "3600000",
    10
  ), // 1 hour
  decayThresholdMs: Number.parseInt(
    process.env.MEMORY_DECAY_THRESHOLD_MS || "86400000",
    10
  ), // 24 hours
  decayFactor: Number.parseFloat(process.env.MEMORY_DECAY_FACTOR || "0.95"), // Reduce by 5%
  pruneConfidence: Number.parseFloat(
    process.env.MEMORY_PRUNE_CONFIDENCE || "0.2"
  ), // Prune < 20%
  cleanupAgeMs: Number.parseInt(
    process.env.MEMORY_CLEANUP_AGE_MS || "2592000000",
    10
  ), // 30 days
  decayLimit: 1000,
  confidenceFloor: 0.01,
  // Episodic Dreaming
  dreamingEnabled: process.env.DREAMING_ENABLED !== "false",
  dreamingIntervalMs: Number.parseInt(
    process.env.DREAMING_INTERVAL_MS || "21600000",
    10
  ), // 6 hours
};

let learningInterval: NodeJS.Timeout | null = null;
let lastMaintenanceTime = 0;
let lastDreamingTime = 0;

export function startLearningWorker(
  config: Partial<LearningWorkerConfig> = {}
) {
  if (learningInterval) {
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  if (!finalConfig.enabled) {
    return;
  }

  logger.info("learning_worker_started", finalConfig);

  const runLoop = async () => {
    try {
      // 1. Learn from new runs
      await processUnlearnedRuns(finalConfig.batchSize);

      // 2. Run memory maintenance periodically (if enabled)
      if (finalConfig.decayEnabled) {
        const now = Date.now();
        if (now - lastMaintenanceTime > finalConfig.maintenanceIntervalMs) {
          await processMemoryMaintenance(finalConfig);
          lastMaintenanceTime = now;
        }
      }

      // 3. Run Episodic Dreaming (if enabled)
      if (finalConfig.dreamingEnabled) {
        const now = Date.now();
        if (now - lastDreamingTime > finalConfig.dreamingIntervalMs) {
          await processDreaming();
          lastDreamingTime = now;
        }
      }
    } catch (error) {
      logger.error("learning_worker_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Initial run
  void (async () => {
    try {
      await seedOntology();
      await runLoop();
    } catch (e) {
      logger.error("learning_worker_init_failed", { error: String(e) });
    }
  })();

  learningInterval = setInterval(runLoop, finalConfig.intervalMs);
}

export function stopLearningWorker() {
  if (learningInterval) {
    clearInterval(learningInterval);
    learningInterval = null;
  }
}

async function processDreaming() {
  logger.debug("learning_worker_dreaming_started");

  try {
    // 1. Fetch failed runs from last 24 hours
    const failedRuns = await db
      .select({
        id: workflowRuns.id,
        errorMessage: workflowRuns.errorMessage,
      })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.status, "failed"),
          sql`${workflowRuns.completedAt} > NOW() - INTERVAL '24 hours'`,
          sql`${workflowRuns.errorMessage} IS NOT NULL`
        )
      )
      .limit(100);

    if (failedRuns.length === 0) {
      logger.debug("learning_worker_dreaming_no_failures");
      return;
    }

    // 2. Cluster by error message (simple exact match or prefix)
    const clusters = new Map<string, { count: number; sample: string }>();

    for (const run of failedRuns) {
      const msg = run.errorMessage || "Unknown error";
      // Normalize: strip random IDs or timestamps if possible.
      // For MVP, just use the first 100 chars as a naive cluster key.
      const key = msg.substring(0, 100);

      const existing = clusters.get(key) || { count: 0, sample: msg };
      existing.count++;
      clusters.set(key, existing);
    }

    // 3. Generate Heuristics
    const heuristics: Array<{
      label: string;
      rule: string;
      trigger: string;
      count: number;
    }> = [];

    for (const [key, cluster] of clusters.entries()) {
      // Only dream about repeated failures or major ones
      if (cluster.count >= 1) {
        heuristics.push({
          label: `Heuristic: Avoid ${key.substring(0, 30)}...`,
          rule: `Avoid causing error: "${cluster.sample}". Previously observed ${cluster.count} times.`,
          trigger: cluster.sample,
          count: cluster.count,
        });
      }
    }

    if (heuristics.length === 0) {
      return;
    }

    // 4. Persist Heuristics
    // Generate embeddings for the "rule" so it can be retrieved contextually
    const embeddings = await embedMany(heuristics.map((h) => h.rule));

    const nodesToUpsert = heuristics.map((h, i) => ({
      resource: "system",
      hash: createHash("sha256").update(h.trigger).digest("hex"),
      kind: "heuristic",
      label: h.label,
      properties: {
        rule: h.rule,
        trigger: h.trigger,
        count: h.count,
        confidence: 0.8, // High confidence in observed failures
        source: "dreamer",
      },
      embedding: embeddings[i],
    }));

    await upsertNodes(nodesToUpsert);
    logger.info("learning_worker_dreaming_complete", {
      created: heuristics.length,
    });
  } catch (error) {
    logger.warn("learning_worker_dreaming_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Learn domain classification from user correction.
 * Creates high-confidence domain association node in the graph.
 *
 * @param text - The text that was classified
 * @param correctDomain - The correct domain (user-provided)
 * @param incorrectDomain - The incorrect domain that was classified (optional)
 */
export async function learnDomainCorrection(
  text: string,
  correctDomain: string,
  incorrectDomain?: string
): Promise<void> {
  logger.info("learning_worker_domain_correction", {
    textLength: text.length,
    correctDomain,
    incorrectDomain,
  });

  try {
    // Generate embedding for semantic similarity matching
    const embeddings = await embedMany([text]);
    const embedding = embeddings[0];

    // Create hash for the domain association
    const hashInput = `domain:${text.substring(0, 500)}:${correctDomain}`;
    const hash = createHash("sha256").update(hashInput).digest("hex");

    // Upsert correct domain association with high confidence
    await upsertNodes([
      {
        resource: "user",
        hash,
        kind: "domain_association",
        label: text.substring(0, 200),
        properties: {
          domain: correctDomain,
          confidence: 0.9, // High confidence for user corrections
          source: "correction",
          correctedFrom: incorrectDomain ?? null,
          correctedAt: new Date().toISOString(),
        },
        embedding,
      },
    ]);

    // If there was an incorrect classification, decay its confidence
    if (incorrectDomain) {
      // Find existing association nodes for the incorrect domain
      const incorrectHash = createHash("sha256")
        .update(`domain:${text.substring(0, 500)}:${incorrectDomain}`)
        .digest("hex");

      // We don't have a direct lookup by hash, but the upsert will handle deduplication
      // The next decay cycle will naturally lower confidence on unused associations
      logger.debug("learning_worker_incorrect_domain_noted", {
        incorrectDomain,
        incorrectHash,
      });
    }

    logger.info("learning_worker_domain_correction_complete", {
      correctDomain,
      hash,
    });
  } catch (error) {
    logger.error("learning_worker_domain_correction_failed", {
      error: error instanceof Error ? error.message : String(error),
      correctDomain,
    });
    throw error;
  }
}

async function processMemoryMaintenance(config: LearningWorkerConfig) {
  logger.debug("learning_worker_maintenance_started");
  const stopTimer = metrics.memoryMaintenanceDurationSeconds.startTimer();

  try {
    // 1. Decay Confidence
    // Find nodes that haven't been updated recently
    const staleNodes = await findNodesForDecay(
      config.decayThresholdMs,
      config.decayLimit
    );
    if (staleNodes.length > 0) {
      const updates = staleNodes.map((node) => {
        const props = (node.properties as Record<string, unknown>) || {};
        const currentConfidence =
          typeof props.confidence === "number" ? props.confidence : 1.0;
        // Apply floor to prevent underflow
        const newConfidence = Math.max(
          config.confidenceFloor,
          currentConfidence * config.decayFactor
        );

        return {
          id: node.id,
          confidence: newConfidence,
        };
      });

      const decayedCount = await updateNodeConfidenceBatch(updates);
      metrics.memoryNodesDecayedTotal.inc(decayedCount);
      logger.info("learning_worker_decayed", { count: decayedCount });
    }

    // 2. Prune Low Confidence
    const lowConfidenceNodes = await findNodesByConfidence(
      0,
      config.pruneConfidence,
      undefined,
      100
    );
    if (lowConfidenceNodes.length > 0) {
      const ids = lowConfidenceNodes.map((n) => n.id);
      const prunedCount = await archiveNodes(ids, "low_confidence");
      metrics.memoryNodesPrunedTotal.inc(prunedCount);
      logger.info("learning_worker_pruned", { count: prunedCount });
    }

    // 3. Cleanup Archived
    const deletedCount = await deleteArchivedNodes(config.cleanupAgeMs);
    if (deletedCount > 0) {
      metrics.memoryNodesCleanedTotal.inc(deletedCount);
      logger.info("learning_worker_cleanup", { count: deletedCount });
    }

    // 4. Decay seed nodes that have learned overrides
    // Seed nodes with higher-confidence learned equivalents should decay faster
    await decaySeedNodesWithLearnedOverrides(config);
  } catch (error) {
    logger.warn("learning_worker_maintenance_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    stopTimer();
  }
}

/**
 * Decay seed nodes that have been superseded by learned knowledge.
 * When a domain_association with source="correction" exists with confidence >= 0.8,
 * any corresponding seed nodes should decay faster.
 */
async function decaySeedNodesWithLearnedOverrides(
  config: LearningWorkerConfig
): Promise<void> {
  try {
    // Find seed nodes (source="seed") in the domain_association kind
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

    // For each seed node, check if there's a learned node with higher confidence
    const updates: Array<{ id: string; confidence: number }> = [];

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

      // Check for learned associations for the same domain with higher confidence
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
        // Seed has been superseded - apply accelerated decay
        const newConfidence = Math.max(
          config.confidenceFloor,
          seedConfidence * config.decayFactor * 0.5 // 2x decay rate for superseded seeds
        );

        updates.push({
          id: seedNode.id,
          confidence: newConfidence,
        });
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

async function seedOntology() {
  logger.debug("learning_worker_seeding_ontology");
  const knowledge = getOntologyKnowledge();
  const nodes = knowledge.filter((k) => k.data._ !== "relation");
  const edges = knowledge.filter((k) => k.data._ === "relation");

  // Upsert Nodes with low confidence to allow learned knowledge to override
  const nodeMap = await upsertNodes(
    nodes.map((k) => ({
      resource: "ontology",
      hash: k.hash,
      kind: k.data._,
      label:
        k.data._ === "fact"
          ? k.data.content
          : k.data._ === "insight"
            ? k.data.conclusion
            : "unknown",
      properties: { confidence: SEED_CONFIDENCE, source: "seed" },
    }))
  );

  // Upsert Edges with seed source for tracking
  const edgeSeeds = edges
    .map((k) => {
      const rel = k.data as {
        from: unknown;
        to: unknown;
        kind: string;
        weight?: number;
      };
      const fromHash = knowledgeHash(rel.from);
      const toHash = knowledgeHash(rel.to);

      const fromNode = nodeMap.get(`ontology:${fromHash}`);
      const toNode = nodeMap.get(`ontology:${toHash}`);

      if (!(fromNode && toNode)) {
        return null;
      }

      return {
        resource: "ontology",
        hash: k.hash,
        fromId: fromNode.id,
        toId: toNode.id,
        kind: rel.kind,
        weight: rel.weight ?? SEED_CONFIDENCE,
        metadata: { source: "seed" },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (edgeSeeds.length > 0) {
    await upsertEdges(edgeSeeds);
  }
}

async function processUnlearnedRuns(limit: number) {
  // Find completed runs that haven't been learned from yet
  const runs = await db
    .select()
    .from(workflowRuns)
    .where(
      and(eq(workflowRuns.status, "completed"), isNull(workflowRuns.learnedAt))
    )
    .orderBy(desc(workflowRuns.completedAt))
    .limit(limit);

  if (runs.length === 0) {
    return;
  }

  logger.debug("learning_worker_processing", { count: runs.length });

  for (const run of runs) {
    try {
      await learnFromRun(run);

      // Mark as learned
      await db
        .update(workflowRuns)
        .set({ learnedAt: new Date() })
        .where(eq(workflowRuns.id, run.id));
    } catch (error) {
      logger.warn("learning_worker_run_failed", {
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // We intentionally don't mark as learned so it retries (or we could add a retry count)
      // For now, simple skip to avoid infinite loops on poison pills?
      // Ideally we'd have a 'learning_attempts' column, but for MVP let's log and skip.
    }
  }
}

async function learnFromRun(run: typeof workflowRuns.$inferSelect) {
  const input = JSON.stringify(run.inputData ?? "");
  const state = JSON.stringify(run.stateData ?? "");

  // Simple heuristic: combine input and output/state to extract facts
  // In a real scenario, we might want to parse specific fields based on workflowId
  const textToAnalyze = `
    Input: ${input}
    Result: ${state}
  `.trim();

  if (textToAnalyze.length < 50) {
    return; // Skip trivial content
  }

  const extraction = extract(textToAnalyze, `run:${run.id}`);
  const knowledgeEntries = toKnowledge(extraction);

  // Extract topic metadata for persistence
  const topicsMeta = {
    topics: extraction.topics,
    primaryDomain: extraction.primaryDomain,
    hasCodeBlock: extraction.hasCodeBlock,
  };

  const [causalEntries, decisionEntries, alternativeEntries] =
    await Promise.all([
      deriveCausalityFromText(textToAnalyze),
      deriveDecisionFacts(textToAnalyze),
      deriveAlternativeFacts(textToAnalyze),
    ]);

  const knowledgeMap = new Map(
    knowledgeEntries.map((entry) => [entry.hash, entry])
  );

  for (const extra of [
    ...causalEntries,
    ...decisionEntries,
    ...alternativeEntries,
  ]) {
    knowledgeMap.set(extra.hash, extra);
  }

  const mergedEntries = Array.from(knowledgeMap.values());

  if (mergedEntries.length === 0) {
    return;
  }

  // Convert to DB format
  // Using 'user' resource for now as this is personal memory
  const resource = "user";

  // Generate embeddings for nodes
  const nodeLabels = mergedEntries.map((entry) => {
    if (entry.data._ === "fact") {
      return entry.data.content || "unknown";
    }
    if (entry.data._ === "insight") {
      return entry.data.conclusion || "unknown";
    }
    if (entry.data._ === "pattern") {
      return entry.data.rule || "unknown";
    }
    return "unknown";
  });

  let embeddings: number[][] = [];
  try {
    embeddings = await embedMany(nodeLabels);
  } catch (e) {
    logger.warn("learning_worker_embedding_failed", {
      error: String(e),
    });
    // Fallback to empty embeddings
    embeddings = new Array(knowledgeEntries.length).fill(undefined);
  }

  // Upsert nodes with topic metadata for domain-aware retrieval
  const nodeMap = await upsertNodes(
    mergedEntries.map((entry, i) => ({
      resource,
      hash: entry.hash,
      kind: entry.data._,
      label: nodeLabels[i] ?? "unknown",
      properties: {
        confidence: (entry.data as { confidence?: number }).confidence ?? 1.0,
        source: `run:${run.id}`,
        runId: run.id,
        workflowId: run.workflowId,
        // Domain-aware learning metadata
        topics: topicsMeta.topics,
        primaryDomain: topicsMeta.primaryDomain,
        hasCodeBlock: topicsMeta.hasCodeBlock,
      },
      embedding: embeddings[i],
    }))
  );

  // Upsert relations (edges)
  const edges = mergedEntries.filter((e) => e.data._ === "relation");

  const edgesToInsert = edges
    .map((edge) => {
      const rel = edge.data as {
        from: unknown;
        to: unknown;
        kind: string;
        weight?: number;
      };
      const map = nodeMap;
      const fromNode = map.get(`${resource}:${rel.from}`);
      const toNode = map.get(`${resource}:${rel.to}`);

      if (!(fromNode && toNode)) {
        return null;
      }

      return {
        resource,
        hash: edge.hash,
        fromId: fromNode.id,
        toId: toNode.id,
        kind: rel.kind,
        weight: rel.weight ?? 1.0,
        metadata: {
          source: `run:${run.id}`,
        },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (edgesToInsert.length > 0) {
    await upsertEdges(edgesToInsert);
  }
}
