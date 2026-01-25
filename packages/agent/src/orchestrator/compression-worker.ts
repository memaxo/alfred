import {
  archiveNodes,
  findNodesByConfidence,
  findStaleNodes,
  updateNodeConfidenceBatch,
} from "@alfred/db/repo/graph";
import {
  type CompressionConfig,
  DEFAULT_COMPRESSION_CONFIG,
} from "@alfred/knowledge/compression";

import {
  recordCompressionCycle,
  recordCompressionNodeUpdate,
  startCompressionCycleTimer,
} from "../metrics";

let compressionInterval: NodeJS.Timeout | null = null;

export type CompressionWorkerConfig = CompressionConfig & {
  intervalMs: number;
  enabled: boolean;
};

const DEFAULT_WORKER_CONFIG: CompressionWorkerConfig = {
  intervalMs: 60 * 60 * 1000,
  enabled: true,
  ...DEFAULT_COMPRESSION_CONFIG,
};

export function startCompressionWorker(
  config: Partial<CompressionWorkerConfig> = {}
): void {
  if (compressionInterval) {
    return;
  }

  const finalConfig: CompressionWorkerConfig = {
    ...DEFAULT_WORKER_CONFIG,
    ...config,
  };

  if (!finalConfig.enabled) {
    return;
  }

  runCompression(finalConfig).catch((_err) => {});

  compressionInterval = setInterval(() => {
    runCompression(finalConfig).catch((_err) => {});
  }, finalConfig.intervalMs);
}

export function stopCompressionWorker(): void {
  if (compressionInterval) {
    clearInterval(compressionInterval);
    compressionInterval = null;
  }
}

async function runCompression(config: CompressionWorkerConfig): Promise<void> {
  // Removed unused _start variable
  const stopTimer = startCompressionCycleTimer();

  try {
    const decayResult = await applyConfidenceDecay(config);
    recordCompressionNodeUpdate("decay", decayResult.updated);

    const archiveResult = await archiveStaleNodes(config);
    recordCompressionNodeUpdate("archive", archiveResult.archived);

    stopTimer({ outcome: "success" });
    recordCompressionCycle("success");
  } catch (error) {
    stopTimer({ outcome: "error" });
    recordCompressionCycle("error");
    throw error;
  }
}

async function applyConfidenceDecay(
  config: CompressionWorkerConfig
): Promise<{ updated: number }> {
  const facts = await findNodesByConfidence(0, 1, "fact", 10_000);
  const insights = await findNodesByConfidence(0, 1, "insight", 10_000);
  const nodes = [...facts, ...insights];

  const updates: { id: string; confidence: number }[] = [];
  const now = Date.now();

  for (const node of nodes) {
    const createdValue = node.created ?? new Date(0);
    const createdMs =
      createdValue instanceof Date
        ? createdValue.getTime()
        : new Date(createdValue).getTime();
    const age = now - createdMs;

    const current =
      typeof node.properties === "object" && node.properties
        ? Number((node.properties as { confidence?: number }).confidence ?? 0.8)
        : 0.8;

    const factor = 0.5 ** (age / config.confidenceDecayHalfLife);
    const decayed = Math.max(0, Math.min(1, current * factor));

    if (Math.abs(decayed - current) > 0.01) {
      updates.push({ id: node.id, confidence: decayed });
    }
  }

  const updated = await updateNodeConfidenceBatch(updates);
  return { updated };
}

async function archiveStaleNodes(
  config: CompressionWorkerConfig
): Promise<{ archived: number }> {
  const staleNodes = await findStaleNodes(
    config.maxAgeThreshold,
    undefined,
    10_000
  );

  const toArchive: string[] = [];

  for (const node of staleNodes) {
    const current =
      typeof node.properties === "object" && node.properties
        ? Number((node.properties as { confidence?: number }).confidence ?? 0.8)
        : 0.8;

    if (current < config.minConfidenceThreshold) {
      toArchive.push(node.id);
    }
  }

  if (toArchive.length === 0) {
    return { archived: 0 };
  }

  const archived = await archiveNodes(toArchive, "confidence_decay");
  return { archived };
}
