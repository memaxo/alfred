/**
 * LLM Fact Extraction and Causal Inference
 * Pure functional extraction with no dependencies
 */
import type { Knowledge } from "./hypergraph.js";
type ExtractedFact = {
    content: string;
    confidence: number;
    source: string;
    entities: string[];
    relations: Array<[string, string, string]>;
};
type CausalLink = {
    cause: string;
    effect: string;
    confidence: number;
    evidence: string[];
};
type ExtractionResult = {
    facts: ExtractedFact[];
    causality: CausalLink[];
    entities: Set<string>;
    contradictions: Array<[string, string]>;
};
/**
 * Extract facts from natural language text
 * Zero allocation design - reuses buffers
 */
export declare const extract: (text: string, source: string) => ExtractionResult;
/**
 * Convert extraction result to knowledge graph nodes
 */
export type KnowledgeEntry = {
    hash: string;
    data: Knowledge;
};
export declare const toKnowledge: (result: ExtractionResult) => KnowledgeEntry[];
/**
 * Infer patterns from multiple examples
 */
export declare const inferPattern: (examples: string[], minSupport?: number) => Knowledge | null;
/**
 * Extract temporal facts (dates, durations, sequences)
 */
export declare const extractTemporal: (text: string) => Array<{
    time: Date;
    fact: string;
}>;
/**
 * Extract knowledge from Codex reasoning traces
 * Focuses on decision rationale, alternatives, and causal chains
 */
export declare const extractReasoning: (text: string, context: {
    threadId?: string;
    turnId?: string;
    source?: string;
}) => ExtractionResult;
/**
 * Enrich knowledge entries with reasoning context metadata
 */
export declare const enrichReasoningContext: (entries: KnowledgeEntry[], context: {
    threadId?: string;
    turnId?: string;
    sessionId?: string;
    timestamp: number;
}) => KnowledgeEntry[];
export {};
//# sourceMappingURL=extractor.d.ts.map