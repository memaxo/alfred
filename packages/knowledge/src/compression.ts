/**
 * Knowledge Graph Compression and Pruning Utilities
 */

import type { Knowledge, NodeId } from "./hypergraph.js";

import { pattern as createPattern } from "./hypergraph.js";

type ConfidentKnowledge = Extract<Knowledge, { confidence: unknown }>;
type InsightKnowledge = Extract<Knowledge, { _: "insight" }>;

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const updateConfidence = <T extends ConfidentKnowledge>(
  node: T,
  value: number
): T => ({
  ...node,
  confidence: clamp(value) as typeof node.confidence,
});

export type CompressionConfig = {
  confidenceDecayHalfLife: number;
  minConfidenceThreshold: number;
  maxAgeThreshold: number;
  patternMinSupport: number;
  patternMinConfidence: number;
};

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  confidenceDecayHalfLife: 7 * 24 * 60 * 60 * 1000,
  minConfidenceThreshold: 0.3,
  maxAgeThreshold: 30 * 24 * 60 * 60 * 1000,
  patternMinSupport: 3,
  patternMinConfidence: 0.7,
};

/**
 * Standard confidence decay without access tracking.
 * Uses simple exponential decay: confidence = initial × 0.5^(elapsed/halfLife)
 */
export function decayConfidence(
  node: Knowledge,
  elapsedMs: number,
  halfLife: number
): Knowledge {
  if (node._ !== "fact" && node._ !== "insight") {
    return node;
  }

  const current = Number(node.confidence);
  const factor = 0.5 ** (elapsedMs / halfLife);
  const next = updateConfidence(node, current * factor);
  return next;
}

/**
 * Adaptive confidence decay based on access frequency.
 * More frequently accessed nodes decay slower.
 *
 * Formula: effective_half_life = base_half_life × (1 + log(1 + access_count))
 *
 * This means:
 * - access_count=0: effective_half_life = base (normal decay)
 * - access_count=9: effective_half_life = base × 2.30 (~2.3x slower decay)
 * - access_count=99: effective_half_life = base × 4.61 (~4.6x slower decay)
 * - access_count=999: effective_half_life = base × 6.91 (~7x slower decay)
 *
 * Reference: alfred-memory-review.md - "Adaptive decay based on access frequency"
 *
 * @param node - The knowledge node to decay
 * @param elapsedMs - Time since last update in milliseconds
 * @param baseHalfLife - Base half-life in milliseconds (before access adjustment)
 * @param accessCount - Number of times this node has been accessed
 * @returns The node with decayed confidence
 */
export function decayConfidenceAdaptive(
  node: Knowledge,
  elapsedMs: number,
  baseHalfLife: number,
  accessCount: number
): Knowledge {
  if (node._ !== "fact" && node._ !== "insight") {
    return node;
  }

  // Calculate effective half-life based on access frequency
  // Formula: effective_half_life = base_half_life × (1 + log(1 + access_count))
  const accessMultiplier = 1 + Math.log(1 + accessCount);
  const effectiveHalfLife = baseHalfLife * accessMultiplier;

  const current = Number(node.confidence);
  const factor = 0.5 ** (elapsedMs / effectiveHalfLife);
  const next = updateConfidence(node, current * factor);
  return next;
}

/**
 * Calculate the effective half-life for a node based on access count.
 * Useful for estimating when a node will decay below a threshold.
 *
 * @param baseHalfLife - Base half-life in milliseconds
 * @param accessCount - Number of times the node has been accessed
 * @returns Effective half-life in milliseconds
 */
export function calculateEffectiveHalfLife(
  baseHalfLife: number,
  accessCount: number
): number {
  return baseHalfLife * (1 + Math.log(1 + accessCount));
}

/**
 * Calculate the access multiplier for a given access count.
 * Returns how many times slower decay will be compared to base.
 *
 * @param accessCount - Number of times the node has been accessed
 * @returns Multiplier for half-life (1.0 = no change, 2.0 = 2x slower)
 */
export function getAccessMultiplier(accessCount: number): number {
  return 1 + Math.log(1 + accessCount);
}

export function consolidatePatterns(
  facts: Array<{ id: NodeId; data: Knowledge }>,
  minSupport: number,
  minConfidence: number
): Knowledge[] {
  const groups = new Map<string, Array<{ id: NodeId; data: Knowledge }>>();

  for (const entry of facts) {
    if (entry.data._ !== "fact") {
      continue;
    }
    const normalized = entry.data.content.toLowerCase().trim();
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)?.push(entry);
  }

  const patterns: Knowledge[] = [];

  for (const [content, group] of groups.entries()) {
    if (group.length < minSupport) {
      continue;
    }

    const avgConfidence =
      group.reduce(
        (sum, { data }) =>
          sum + Number((data as ConfidentKnowledge).confidence ?? 0),
        0
      ) / group.length;

    if (avgConfidence < minConfidence) {
      continue;
    }

    const exampleIds = group.map((item) => item.id);
    const rule = `Pattern: ${content} (${group.length} instances)`;
    const accuracy = clamp(avgConfidence + 0.1);

    patterns.push(createPattern(exampleIds, rule, accuracy));
  }

  return patterns;
}

export function identifyPrunableNodes(
  nodes: Array<{ id: NodeId; data: Knowledge; createdMs: number }>,
  config: CompressionConfig,
  currentTimeMs: number
): NodeId[] {
  const prunable: NodeId[] = [];

  for (const node of nodes) {
    const age = currentTimeMs - node.createdMs;
    if (age < config.maxAgeThreshold) {
      continue;
    }

    let confidenceValue = 1;
    if (node.data._ === "fact" || node.data._ === "insight") {
      confidenceValue = Number(node.data.confidence);
    }

    const decayed = decayConfidence(
      node.data,
      age,
      config.confidenceDecayHalfLife
    );

    if (
      (decayed._ === "fact" || decayed._ === "insight") &&
      Number(decayed.confidence) < config.minConfidenceThreshold
    ) {
      prunable.push(node.id);
    } else if (confidenceValue < config.minConfidenceThreshold) {
      prunable.push(node.id);
    }
  }

  return prunable;
}

export function compressTransitiveRelations(
  relations: Array<{
    id: NodeId;
    from: NodeId;
    to: NodeId;
    kind: string;
    weight: number;
  }>
): Array<{
  from: NodeId;
  to: NodeId;
  via: NodeId[];
  kind: string;
  weight: number;
}> {
  const adjacency = new Map<
    NodeId,
    Array<{ to: NodeId; kind: string; weight: number; id: NodeId }>
  >();

  for (const relation of relations) {
    if (!adjacency.has(relation.from)) {
      adjacency.set(relation.from, []);
    }
    adjacency.get(relation.from)?.push({
      to: relation.to,
      kind: relation.kind,
      weight: relation.weight,
      id: relation.id,
    });
  }

  const compressed: Array<{
    from: NodeId;
    to: NodeId;
    via: NodeId[];
    kind: string;
    weight: number;
  }> = [];

  for (const [from, edges] of adjacency.entries()) {
    for (const first of edges) {
      const nextEdges = adjacency.get(first.to);
      if (!nextEdges) {
        continue;
      }

      for (const second of nextEdges) {
        if (first.kind !== second.kind) {
          continue;
        }

        compressed.push({
          from,
          to: second.to,
          via: [first.to],
          kind: first.kind,
          weight: first.weight * second.weight * 0.9,
        });
      }
    }
  }

  return compressed;
}

export function promoteToInsights(
  accessLog: Array<{ nodeId: NodeId; timestamp: number }>,
  nodes: Map<NodeId, Knowledge>,
  minAccess: number,
  windowMs: number,
  currentTimeMs: number
): InsightKnowledge[] {
  const counts = new Map<NodeId, number>();

  for (const entry of accessLog) {
    const age = currentTimeMs - entry.timestamp;
    if (age > windowMs) {
      continue;
    }
    counts.set(entry.nodeId, (counts.get(entry.nodeId) ?? 0) + 1);
  }

  const insights: InsightKnowledge[] = [];

  for (const [nodeId, count] of counts.entries()) {
    if (count < minAccess) {
      continue;
    }

    const node = nodes.get(nodeId);
    if (!node || node._ !== "fact") {
      continue;
    }

    const current = Number(node.confidence);
    const bumped = clamp(current + 0.2);

    insights.push({
      _: "insight",
      derived: [nodeId],
      conclusion: `Frequently accessed: ${node.content}`,
      confidence: bumped as typeof node.confidence,
    });
  }

  return insights;
}
