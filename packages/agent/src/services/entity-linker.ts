import {
  entityLinkingDurationMs,
  entityLinkingFallbackTotal,
} from "@alfred/api/metrics";
import { findNearestConcept } from "@alfred/db/repo/graph";
import { extract } from "@alfred/knowledge/extractor";
import { ANCHORS } from "@alfred/knowledge/ontology";
import { embedMany } from "@alfred/rag";

export interface EntityLinkResult {
  domains: string[];
  paths: string[][];
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
  let embeddings: number[][] = [];
  try {
    embeddings = await embedMany(candidates);
  } catch (e) {
    console.warn("Failed to generate embeddings for entity linking", e);
    entityLinkingFallbackTotal.inc();
    // Fallback to empty embeddings (will use string match)
    embeddings = new Array(candidates.length).fill(undefined);
  }

  // Parallelize graph queries
  await Promise.all(
    candidates.map(async (entity, i) => {
      try {
        const result = await findNearestConcept(
          entity,
          targetConcepts,
          3,
          "ontology",
          embeddings[i]
        );

        // Normalization: Map "Coding" -> "Coding" (case match)
        if (result && result.node) {
          const nodeLabel = result.node.label || result.concept;
          detectedConcepts.add(nodeLabel);
          detectedPaths.push(result.path);
        }
      } catch (e) {
        console.error("ADAPTER GRAPH QUERY ERROR:", e);
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
