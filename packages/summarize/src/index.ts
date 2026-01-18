/**
 * @alfred/summarize - LongCodeZip-based text summarization
 *
 * Provides intelligent context compression using:
 * - Two-stage hierarchical compression (coarse + fine)
 * - Approximated Mutual Information (AMI) relevance scoring
 * - Entropy-based semantic chunking
 * - 0/1 Knapsack optimal block selection
 *
 * Uses a Python subprocess for the core ML operations (perplexity, AMI)
 * with automatic fallback to heuristics when Python is unavailable.
 *
 * @see https://arxiv.org/abs/2510.00446 (LongCodeZip paper)
 *
 * @example
 * ```ts
 * import { summarize, chunk, ami } from "@alfred/summarize";
 *
 * // Summarize text
 * const result = await summarize("Long document...", {
 *   targetRatio: 0.3,
 *   instruction: "Focus on technical concepts"
 * });
 *
 * // Entropy-based chunking
 * const chunks = await chunk("Text to split...");
 *
 * // Calculate context relevance
 * const relevance = await ami("Context...", {
 *   instruction: "How does auth work?"
 * });
 * ```
 */

// Process management (for advanced use)
export { SummarizeProcess } from "./process.js";
// Schemas (for validation)
export {
  CompressionMetadataSchema,
  LLMSummarizeOutputSchema,
  SemanticChunkSchema,
  STYLE_PROMPTS,
  SummarizeResultSchema,
  SummarizeStyleSchema,
} from "./schema.js";
// Core summarization API
export {
  ami,
  chunk,
  getHealth,
  initialize,
  isPythonAvailable,
  shutdown,
  summarize,
} from "./summarize.js";
// Types
export type {
  AmiOptions,
  AmiResult,
  ChunkOptions,
  ChunkResult,
  ProcessHealth,
  SummarizeConfig,
  SummarizeOptions,
  SummarizeResult,
} from "./types.js";
