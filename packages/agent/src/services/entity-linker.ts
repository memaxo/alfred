import {
  entityLinkingDurationMs,
  entityLinkingFallbackTotal,
} from "@alfred/api/metrics";
import { findNearestConcept } from "@alfred/db/repo/graph";
import { extract } from "@alfred/knowledge/extractor";
import { ANCHORS } from "@alfred/knowledge/ontology";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";

// Type for findNearestConcept result (defined locally to work around stale dist types)
type ConceptResult = {
  concept: string;
  path: string[];
  node: { id: string; label: string };
} | null;

export type EntityLinkResult = {
  domains: string[];
  paths: string[][];
};

const ENTITY_HEURISTICS = new Map<string, string>([
  ["react", "Coding"],
  ["python", "Coding"],
  ["typescript", "Coding"],
  ["javascript", "Coding"],
  ["docker", "Coding"],
  ["nextjs", "Coding"],
  ["kali", "Security"],
  ["security", "Security"],
  ["xss", "Security"],
  ["owasp", "Security"],
  ["llm", "AI"],
  ["ai", "AI"],
  ["gpt", "AI"],
  ["transformer", "AI"],
  ["politics", "Politics"],
  ["congress", "Politics"],
  ["senate", "Politics"],
  ["election", "Politics"],
  ["news", "News"],
  ["headline", "News"],
  ["reuters", "News"],
  ["bloomberg", "News"],
]);

function normalizeEntity(entity: string): string {
  return entity.trim().toLowerCase();
}

function shouldSkipEmbedding(entity: string): boolean {
  return ENTITY_HEURISTICS.has(normalizeEntity(entity));
}

/**
 * Analyze the conversation context to determine the dominant domain.
 * Uses Graph Topology:
 * 1. Extract entities from recent messages.
 * 2. Find path from entities to Anchor Concepts in the Graph.
 */
export async function linkEntities(
  messages: Array<{ role: string; content: string }>
): Promise<EntityLinkResult> {
  const stopTimer = entityLinkingDurationMs.startTimer();

  // Aggregate the last 3 user messages to get current context
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join("\n");

  if (recentUserMessages.length === 0) {
    stopTimer();
    return { domains: [], paths: [] };
  }

  // 1. Extract entities using simple NLP
  const extraction = extract(recentUserMessages, "adapter-context");
  const entities = new Set(extraction.entities);

  // Always add capitalized words as potential entities (improves recall)
  const manualEntities = recentUserMessages
    .split(/\s+/)
    .filter((w) => /^[A-Z][a-z]+$/.test(w)) // Simple capitalized word check
    .filter((w) => w.length > 3);

  manualEntities.forEach((e) => entities.add(e));

  // Also support simple single-word inputs that might not be capitalized or detected
  if (entities.size === 0 && recentUserMessages.split(/\s+/).length < 5) {
    recentUserMessages
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .forEach((e) => entities.add(e));
  }

  if (entities.size === 0) {
    stopTimer();
    return { domains: [], paths: [] };
  }

  // 2. Query the Graph for connection to Anchor Concepts
  // We check the first 5 entities to keep latency low
  const candidates = Array.from(entities).slice(0, 5);
  const detectedConcepts = new Set<string>();
  const detectedPaths: string[][] = [];
  const targetConcepts = Object.keys(ANCHORS);

  // Generate embeddings for vector-native entity linking
  const embeddings: Array<number[] | undefined> = new Array(candidates.length).fill(
    undefined
  );
  const embeddingTargets = candidates
    .map((entity, index) => ({ entity, index }))
    .filter(({ entity }) => !shouldSkipEmbedding(entity));

  if (embeddingTargets.length > 0) {
    try {
      const vectors = await embedMany(
        embeddingTargets.map((target) => target.entity)
      );
      for (let i = 0; i < vectors.length; i++) {
        const target = embeddingTargets[i];
        if (target) {
          embeddings[target.index] = vectors[i];
        }
      }
    } catch (e) {
      logger.warn("Failed to generate embeddings for entity linking", {
        error: e,
      });
      entityLinkingFallbackTotal.inc();
    }
  }

  // Parallelize graph queries
  await Promise.all(
    candidates.map(async (entity, i) => {
      try {
        // Cast needed due to stale dist types - rebuild @alfred/db to fix
        const result = (await findNearestConcept(
          entity,
          targetConcepts,
          3,
          "ontology",
          embeddings[i],
          0.5
        )) as ConceptResult;

        // Normalization: Map "Coding" -> "Coding" (case match)
        if (result?.node) {
          const nodeLabel = result.node.label || result.concept;
          detectedConcepts.add(nodeLabel);
          detectedPaths.push(result.path);
        }
      } catch (e) {
        logger.error("ADAPTER GRAPH QUERY ERROR", { error: e });
        // Ignore graph query errors (fail open)
      }
    })
  );

  stopTimer();

  return {
    domains: Array.from(detectedConcepts),
    paths: detectedPaths,
  };
}
