/**
 * Knowledge Domain Types
 */

export type KnowledgeConfidence = number & { readonly _: unique symbol };

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
