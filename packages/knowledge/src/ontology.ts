import type { Knowledge } from "./hypergraph.js";

import { fact, knowledgeHash, nodeFromHash, relation } from "./hypergraph.js";

/**
 * Knowledge Source Types for tiered seed confidence
 * Reference: alfred-memory-review.md - "Bootstrap ontology seeding should vary by knowledge type"
 */
export type KnowledgeSourceType =
  | "official" // Official documentation, verified facts
  | "established" // Well-established community knowledge
  | "inferred" // Inferred relationships, derived knowledge
  | "community" // Community-sourced, moderate reliability
  | "preference"; // User-specific preferences, high update expectation

/**
 * Tiered seed confidence levels by knowledge source type
 *
 * Higher confidence = harder to override with learned knowledge
 * Lower confidence = more easily overridden, expects frequent updates
 *
 * Reference: alfred-memory-review.md recommends:
 * - Official documentation: 0.8 (high source reliability)
 * - Well-established facts: 0.7 (strong prior evidence)
 * - Inferred relationships: 0.5 (maximum uncertainty)
 * - Community knowledge: 0.5 (moderate reliability)
 * - User-specific preferences: 0.4 (high update expectation)
 */
export const SEED_CONFIDENCE_BY_TYPE: Record<KnowledgeSourceType, number> = {
  official: 0.8,
  established: 0.7,
  inferred: 0.5,
  community: 0.5,
  preference: 0.4,
} as const;

/**
 * Default seed confidence (backwards compatibility)
 * Uses "inferred" level as the default for unclassified knowledge
 */
export const SEED_CONFIDENCE = SEED_CONFIDENCE_BY_TYPE.inferred;

/**
 * Get seed confidence for a specific knowledge source type
 */
export function getSeedConfidence(sourceType: KnowledgeSourceType): number {
  return SEED_CONFIDENCE_BY_TYPE[sourceType];
}

/**
 * Ontology Anchors
 * These are the immutable "Platonic Ideals" of the system.
 * The graph topology uses these as roots for classification.
 */
export const ANCHORS = {
  Coding: "concept:coding",
  Security: "concept:security",
  Politics: "concept:politics",
  AI: "concept:ai",
  News: "concept:news",
} as const;

export interface RiskAnchor {
  label: string;
  id: string;
  level: "low" | "medium" | "high";
  description: string;
}

export interface PatternAnchor {
  label: string;
  id: string;
  pattern: "causal" | "decision" | "alternative";
  description: string;
}

export const RISK_ANCHORS: RiskAnchor[] = [
  {
    label: "Concept:HighRisk",
    id: "concept:highrisk",
    level: "high",
    description:
      "Actions that permanently delete data, spend money, change production systems, or expose private information beyond Alfred's owner.",
  },
  {
    label: "Concept:MediumRisk",
    id: "concept:mediumrisk",
    level: "medium",
    description:
      "Operations that edit files, send messages, or call APIs that can be reverted but still impact the outside world without immediate approval.",
  },
  {
    label: "Concept:LowRisk",
    id: "concept:lowrisk",
    level: "low",
    description:
      "Pure analysis, read-only exploration, drafts, or local experiments that cannot affect external systems or finances.",
  },
];

export const PATTERN_ANCHORS: PatternAnchor[] = [
  {
    label: "Pattern:Causal",
    id: "pattern:causal",
    pattern: "causal",
    description:
      "Text that describes a cause leading to an effect, e.g. 'because', 'therefore', explicit trigger-response structures.",
  },
  {
    label: "Pattern:Decision",
    id: "pattern:decision",
    pattern: "decision",
    description:
      "Statements that weigh options or announce a choice, often referencing criteria, trade-offs, or selected plans.",
  },
  {
    label: "Pattern:Alternative",
    id: "pattern:alternative",
    pattern: "alternative",
    description:
      "Language that contrasts multiple approaches, highlights 'instead', 'on the other hand', or proposes backups.",
  },
];

const ALL_ANCHORS = [
  ...Object.entries(ANCHORS).map(([label, id]) => ({
    label,
    id,
  })),
  ...RISK_ANCHORS.map((anchor) => ({ label: anchor.label, id: anchor.id })),
  ...PATTERN_ANCHORS.map((anchor) => ({ label: anchor.label, id: anchor.id })),
];

/**
 * Typed ontology triple with source classification
 * [Subject, Relation, Object, SourceType]
 */
type TypedOntologyTriple = [string, string, string, KnowledgeSourceType];

/**
 * Minimal Seed Ontology with tiered confidence
 * Provides just enough structure for "Emergence" to start working.
 * Users/Agents add to this graph over time.
 *
 * Source types:
 * - "established": Well-known domain categories (high confidence)
 * - "community": Specific tech relationships (can be overridden)
 * - "official": Risk/Safety definitions (verified, high confidence)
 * - "inferred": Pattern relationships (learned from usage)
 */
const SEED_DATA: TypedOntologyTriple[] = [
  // Coding domain structure - established knowledge
  ["Frontend", "related_to", "Coding", "established"],
  ["Backend", "related_to", "Coding", "established"],
  ["Database", "related_to", "Coding", "established"],
  ["DevOps", "related_to", "Coding", "established"],
  ["Algorithm", "related_to", "Coding", "established"],

  // Specific Tech - community knowledge (easily overridden as tech evolves)
  ["React", "is_a", "Frontend", "community"],
  ["TypeScript", "is_a", "Frontend", "community"],
  ["Node.js", "is_a", "Backend", "community"],
  ["Postgres", "is_a", "Database", "community"],
  ["Docker", "is_a", "DevOps", "community"],
  ["Rust", "is_a", "Backend", "community"],

  // Security domain - established knowledge
  ["Vulnerability", "related_to", "Security", "established"],
  ["Encryption", "related_to", "Security", "established"],
  ["Authentication", "related_to", "Security", "established"],
  ["CVE", "is_a", "Vulnerability", "community"],
  ["XSS", "is_a", "Vulnerability", "community"],

  // AI domain - established structure
  ["Machine Learning", "related_to", "AI", "established"],
  ["LLM", "is_a", "Machine Learning", "community"],
  ["Transformer", "is_a", "Machine Learning", "community"],
  ["RAG", "related_to", "AI", "community"],

  // Safety / Risk Anchors - official definitions (high confidence)
  ["Safety", "related_to", "Security", "official"],
  ["Risk", "related_to", "Safety", "official"],
  ["Concept:HighRisk", "is_a", "Risk", "official"],
  ["Concept:MediumRisk", "is_a", "Risk", "official"],
  ["Concept:LowRisk", "is_a", "Risk", "official"],

  // Pattern Anchors - inferred relationships
  ["Knowledge", "related_to", "AI", "inferred"],
  ["Pattern", "related_to", "Knowledge", "inferred"],
  ["Pattern:Causal", "is_a", "Pattern", "inferred"],
  ["Pattern:Decision", "is_a", "Pattern", "inferred"],
  ["Pattern:Alternative", "is_a", "Pattern", "inferred"],
];

/**
 * Anchor confidence by type
 * - Domain anchors (Coding, Security, etc.): established (0.7)
 * - Risk anchors: official (0.8)
 * - Pattern anchors: inferred (0.5)
 */
function getAnchorConfidence(label: string): number {
  if (label.startsWith("Concept:")) {
    // Risk anchors are official definitions
    return SEED_CONFIDENCE_BY_TYPE.official;
  }
  if (label.startsWith("Pattern:")) {
    // Pattern anchors are inferred
    return SEED_CONFIDENCE_BY_TYPE.inferred;
  }
  // Domain anchors are well-established
  return SEED_CONFIDENCE_BY_TYPE.established;
}

export function getOntologyKnowledge(): { hash: string; data: Knowledge }[] {
  const list: { hash: string; data: Knowledge }[] = [];

  // 1. Create Anchor Nodes with tiered confidence
  for (const anchor of ALL_ANCHORS) {
    const confidence = getAnchorConfidence(anchor.label);
    const k = fact(anchor.label, confidence, "ontology");
    list.push({ hash: knowledgeHash(k), data: k });
  }

  // 2. Create Triples with tiered confidence based on source type
  for (const [sub, rel, obj, sourceType] of SEED_DATA) {
    const confidence = getSeedConfidence(sourceType);
    const s = fact(sub, confidence, "ontology");
    const o = fact(obj, confidence, "ontology");
    const sHash = knowledgeHash(s);
    const oHash = knowledgeHash(o);

    list.push({ hash: sHash, data: s });
    list.push({ hash: oHash, data: o });

    const r = relation(
      nodeFromHash(sHash),
      nodeFromHash(oHash),
      rel,
      confidence
    );
    list.push({ hash: knowledgeHash(r), data: r });
  }

  return list;
}

/**
 * Get ontology knowledge with explicit source type tracking
 * Returns additional metadata for each knowledge item
 */
export function getOntologyKnowledgeWithMetadata(): {
  hash: string;
  data: Knowledge;
  sourceType: KnowledgeSourceType;
  confidence: number;
}[] {
  const list: {
    hash: string;
    data: Knowledge;
    sourceType: KnowledgeSourceType;
    confidence: number;
  }[] = [];

  // 1. Create Anchor Nodes
  for (const anchor of ALL_ANCHORS) {
    const sourceType: KnowledgeSourceType = anchor.label.startsWith("Concept:")
      ? "official"
      : (anchor.label.startsWith("Pattern:")
        ? "inferred"
        : "established");
    const confidence = getSeedConfidence(sourceType);
    const k = fact(anchor.label, confidence, "ontology");
    list.push({ hash: knowledgeHash(k), data: k, sourceType, confidence });
  }

  // 2. Create Triples
  for (const [sub, rel, obj, sourceType] of SEED_DATA) {
    const confidence = getSeedConfidence(sourceType);
    const s = fact(sub, confidence, "ontology");
    const o = fact(obj, confidence, "ontology");
    const sHash = knowledgeHash(s);
    const oHash = knowledgeHash(o);

    list.push({ hash: sHash, data: s, sourceType, confidence });
    list.push({ hash: oHash, data: o, sourceType, confidence });

    const r = relation(
      nodeFromHash(sHash),
      nodeFromHash(oHash),
      rel,
      confidence
    );
    list.push({ hash: knowledgeHash(r), data: r, sourceType, confidence });
  }

  return list;
}
