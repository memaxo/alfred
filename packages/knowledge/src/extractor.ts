/**
 * Knowledge extraction facade.
 * Re-exports all extraction functions for backward compatibility.
 *
 * Implementation split into extract/ modules per `.ruler/09-purity-and-performance.md`
 * to meet file size limits (max 500 lines).
 */

export { detectContradiction } from "./extract/contradictions.js";
export {
  canonicalize,
  clampConfidence,
  cleanText,
  extractEntities,
  isStopword,
} from "./extract/entities.js";
export { extract, type KnowledgeEntry, toKnowledge } from "./extract/facts.js";
export { inferPattern } from "./extract/patterns.js";
export {
  enrichReasoningContext,
  extractReasoning,
} from "./extract/reasoning.js";
export { extractRelations } from "./extract/relations.js";
export { extractTemporal } from "./extract/temporal.js";
export * from "./extract/types.js";
