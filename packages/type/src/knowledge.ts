/**
 * Knowledge Domain Types
 */

export type KnowledgeConfidence = number & { readonly _: unique symbol };

export type KnowledgeFact = {
  id: string;
  content: string;
  confidence: KnowledgeConfidence;
  source?: string;
  timestamp?: string;
  tags?: string[];
};

export type KnowledgeRelation = {
  id: string;
  from: string;
  to: string;
  kind: string;
  weight?: number;
  metadata?: Record<string, unknown>;
};

export type KnowledgeInsight = {
  id: string;
  derived: string[];
  conclusion: string;
  confidence: KnowledgeConfidence;
  rationale?: string;
};

export type KnowledgePattern = {
  id: string;
  examples: string[];
  rule: string;
  accuracy?: number;
  notes?: string;
};

export type KnowledgeNode =
  | KnowledgeFact
  | KnowledgeRelation
  | KnowledgeInsight
  | KnowledgePattern;

export type KnowledgeUpdate = {
  node: KnowledgeNode;
  replace?: boolean;
};
