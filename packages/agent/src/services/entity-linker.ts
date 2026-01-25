import { findNearestConcept } from "@alfred/db/repo/graph";
import { extract } from "@alfred/knowledge/extractor";
import {
  classifyDomain,
  classifyDomainWithLearning,
  type DomainResult,
} from "@alfred/knowledge/lexicon/domains";
import { ANCHORS } from "@alfred/knowledge/ontology";
import { logger } from "@alfred/logger";
import {
  entityLinkingDurationMs,
  entityLinkingFallbackTotal,
} from "@alfred/metrics/shared";
import { embedMany } from "@alfred/rag";

// Type for findNearestConcept result (defined locally to work around stale dist types)
type ConceptResult = {
  concept: string;
  path: string[];
  node: { id: string; label: string };
} | null;

// Type for findNearestConcept function (defined locally to work around stale dist types)
type FindNearestConceptFn = (
  startNodeLabel: string | undefined,
  targetConcepts: string[],
  maxDepth: number,
  resource?: string,
  embedding?: number[],
  matchThresholdOrOptions?: number | unknown
) => Promise<ConceptResult>;

// Type for findDomainAssociations result (defined locally to work around stale dist types)
interface DomainAssociation {
  domain: string;
  confidence: number;
  source: "learned" | "seed";
}

export interface EntityLinkResult {
  domains: string[];
  domainResults?: DomainResult[];
  paths: string[][];
}

function shouldSkipEmbedding(entity: string): boolean {
  // Skip embedding if domain classification already detected it (sync path)
  const domains = classifyDomain(entity);
  return domains.length > 0;
}

/**
 * Lazy import of findDomainAssociations to avoid build dependency issues
 */
async function getFindDomainAssociations(): Promise<
  typeof import("@alfred/db/repo/graph/read").findDomainAssociations
> {
  const { findDomainAssociations } = await import("@alfred/db/repo/graph/read");
  return findDomainAssociations;
}

/**
 * Adapter for findDomainAssociations to match DomainResult type
 */
async function findAssociationsAdapter(
  text: string,
  resource: string,
  limit?: number
): Promise<DomainResult[]> {
  const findDomainAssociations = await getFindDomainAssociations();
  const associations = await findDomainAssociations(text, resource, limit);
  return associations.map((a: DomainAssociation) => ({
    domain: a.domain,
    confidence: a.confidence,
    source: a.source,
  }));
}

/**
 * Analyze the conversation context to determine the dominant domain.
 * Uses Graph Topology:
 * 1. Extract entities from recent messages.
 * 2. Find path from entities to Anchor Concepts in the Graph.
 */
export async function linkEntities(
  messages: { role: string; content: string }[]
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

  // 2. Use domain classification with learning for improved detection
  const classifiedDomains = await classifyDomainWithLearning(
    recentUserMessages,
    "user",
    findAssociationsAdapter
  );
  const detectedConcepts = new Set<string>(
    classifiedDomains.map((d) => d.domain)
  );

  // 3. Query the Graph for connection to Anchor Concepts
  // We check the first 5 entities to keep latency low
  const candidates = [...entities].slice(0, 5);
  const detectedPaths: string[][] = [];
  const targetConcepts = Object.keys(ANCHORS);

  // Generate embeddings for vector-native entity linking
  const embeddings: (number[] | undefined)[] = Array.from({
    length: candidates.length,
  });
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
    } catch (error) {
      logger.warn("Failed to generate embeddings for entity linking", {
        error: error,
      });
      entityLinkingFallbackTotal.inc();
    }
  }

  // Parallelize graph queries
  await Promise.all(
    candidates.map(async (entity, i) => {
      try {
        // Cast needed due to stale dist types - rebuild @alfred/db to fix
        const result = await (findNearestConcept as FindNearestConceptFn)(
          entity,
          targetConcepts,
          3,
          "ontology",
          embeddings[i],
          0.5
        );

        // Normalization: Map "Coding" -> "Coding" (case match)
        if (result?.node) {
          const nodeLabel = result.node.label || result.concept;
          detectedConcepts.add(nodeLabel);
          detectedPaths.push(result.path);
        }
      } catch (error) {
        logger.error("ADAPTER GRAPH QUERY ERROR", { error: error });
        // Ignore graph query errors (fail open)
      }
    })
  );

  stopTimer();

  return {
    domains: [...detectedConcepts],
    domainResults: classifiedDomains,
    paths: detectedPaths,
  };
}
