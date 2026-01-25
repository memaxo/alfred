/**
 * Knowledge Domain Types
 */

export type KnowledgeConfidence = number & { readonly _: unique symbol };

/**
 * Knowledge Source Types for tiered seed confidence
 * Reference: alfred-memory-review.md - "Bootstrap ontology seeding should vary by knowledge type"
 *
 * - official: Official documentation, verified facts (0.8)
 * - established: Well-established community knowledge (0.7)
 * - inferred: Inferred relationships, derived knowledge (0.5)
 * - community: Community-sourced, moderate reliability (0.5)
 * - preference: User-specific preferences, high update expectation (0.4)
 */
export type KnowledgeSourceType =
  | "official"
  | "established"
  | "inferred"
  | "community"
  | "preference";

export interface KnowledgeFact {
  id: string;
  content: string;
  confidence: KnowledgeConfidence;
  source?: string;
  timestamp?: string;
  tags?: string[];
}

export interface KnowledgeRelation {
  id: string;
  from: string;
  to: string;
  kind: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeInsight {
  id: string;
  derived: string[];
  conclusion: string;
  confidence: KnowledgeConfidence;
  rationale?: string;
}

export interface KnowledgePattern {
  id: string;
  examples: string[];
  rule: string;
  accuracy?: number;
  notes?: string;
}

export type KnowledgeNode =
  | KnowledgeFact
  | KnowledgeRelation
  | KnowledgeInsight
  | KnowledgePattern;

export interface KnowledgeUpdate {
  node: KnowledgeNode;
  replace?: boolean;
}
