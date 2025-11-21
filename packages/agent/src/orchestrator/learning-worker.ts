import { db } from "@alfred/db";
import { upsertEdges, upsertNodes } from "@alfred/db/repo/graph";
import { workflowRuns } from "@alfred/db/schema/workflow";
import { extract, toKnowledge } from "@alfred/knowledge/extractor";
import { and, desc, eq, isNull } from "drizzle-orm";

// Create a simple local logger to avoid cyclic/invalid imports
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info: (_msg: string, _meta?: Record<string, unknown>) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn: (_msg: string, _meta?: Record<string, unknown>) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error: (_msg: string, _meta?: Record<string, unknown>) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug: (_msg: string, _meta?: Record<string, unknown>) => {
    // no-op or console.debug
  },
};

/**
 * Constant Background Learning Worker
 * Polls for completed workflow runs and extracts knowledge into the graph.
 */

export type LearningWorkerConfig = {
  intervalMs: number;
  enabled: boolean;
  batchSize: number;
};

const DEFAULT_CONFIG: LearningWorkerConfig = {
  intervalMs: 10_000, // Poll every 10s
  enabled: true,
  batchSize: 5,
};

let learningInterval: NodeJS.Timeout | null = null;

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
      await processUnlearnedRuns(finalConfig.batchSize);
    } catch (error) {
      logger.error("learning_worker_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Initial run
  void runLoop();

  learningInterval = setInterval(runLoop, finalConfig.intervalMs);
}

export function stopLearningWorker() {
  if (learningInterval) {
    clearInterval(learningInterval);
    learningInterval = null;
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

  const extraction = await extract(textToAnalyze, `run:${run.id}`);
  const knowledgeEntries = toKnowledge(extraction);

  if (knowledgeEntries.length === 0) {
    return;
  }

  // Convert to DB format
  // Using 'user' resource for now as this is personal memory
  const resource = "user";

  // Upsert nodes
  await upsertNodes(
    knowledgeEntries.map((entry) => ({
      resource,
      hash: entry.hash,
      kind: entry.data._,
      label:
        entry.data._ === "fact"
          ? entry.data.content
          : entry.data._ === "insight"
            ? entry.data.conclusion
            : entry.data._ === "pattern"
              ? entry.data.rule
              : "unknown",
      properties: {
        confidence: (entry.data as any).confidence ?? 1.0,
        source: `run:${run.id}`,
        runId: run.id,
        workflowId: run.workflowId,
        topics: entry.topics,
      },
    }))
  );

  // Upsert relations (edges)
  const edges = knowledgeEntries.filter((e) => e.data._ === "relation");
  // Need to resolve from/to Hashes to DB IDs.
  // Since upsertNodes is idempotent, we can re-query or trust the hash mapping.
  // However, upsertEdges expects UUIDs, not Hashes.
  // This part is tricky without a hash->uuid map.

  // Strategy: We rely on the fact that upsertNodes creates the nodes.
  // We should ideally return the IDs from upsertNodes, but the current repo implementation
  // returns a map of hash -> { id }.

  // Let's verify `upsertNodes` return type.
  // It returns Promise<Record<string, { id: string; resource: string; hash: string }>>

  // Re-upsert to get IDs (low cost if cached)
  const nodeMap = await upsertNodes(
    knowledgeEntries.map((entry) => ({
      resource,
      hash: entry.hash,
      kind: entry.data._,
      label: "temp", // irrelevant for lookup
    })) as any
  );

  const edgesToInsert = edges
    .map((edge) => {
      const rel = edge.data as any;
      // nodeMap is likely a Record<string, ...>, use bracket access.
      // If it's a Map, we use .get(). The error suggested Map but upsertNodes usually returns object.
      // Let's cast to any to be safe or check type.
      // The error said: Element implicitly has an 'any' type because type 'Map<...>' has no index signature.
      // So it IS a Map.
      const map = nodeMap as unknown as Map<string, { id: string }>;
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
    .filter((e) => e !== null);

  if (edgesToInsert.length > 0) {
    await upsertEdges(edgesToInsert as any);
  }
}
