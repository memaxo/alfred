/**
 * Zod schemas and TypeScript types for the summarization package.
 */

import { z } from "zod";

// =============================================================================
// Summarization Styles
// =============================================================================

/**
 * Available summarization styles.
 */
export const SummarizeStyleSchema = z.enum([
  "brief",
  "detailed",
  "bullets",
  "technical",
]);

export type SummarizeStyle = z.infer<typeof SummarizeStyleSchema>;

/**
 * Style-specific prompts for guiding summarization output.
 */
export const STYLE_PROMPTS: Record<SummarizeStyle, string> = {
  brief:
    "Summarize in 1-2 sentences, focusing on the single most important point.",
  detailed:
    "Provide a comprehensive summary preserving all key details and nuances.",
  bullets: "Extract 3-5 key points as concise bullet points.",
  technical: "Summarize the technical contributions and methodology.",
} as const;

// =============================================================================
// Compression Metadata
// =============================================================================

/**
 * Metadata about the compression process.
 */
export const CompressionMetadataSchema = z.object({
  /** Original token count before compression */
  originalTokens: z.number().int().nonnegative(),
  /** Token count after compression */
  compressedTokens: z.number().int().nonnegative(),
  /** Compression ratio (e.g., 0.3 = compressed to 30% of original) */
  ratio: z.number().positive(),
  /** Method used for compression */
  method: z.enum(["longcodezip", "heuristic"]),
  /** Processing time in milliseconds */
  processingTimeMs: z.number().nonnegative(),
});

export type CompressionMetadata = z.infer<typeof CompressionMetadataSchema>;

// =============================================================================
// Summarization Result
// =============================================================================

/**
 * Result returned from summarize().
 */
export const SummarizeResultSchema = z.object({
  /** The compressed/summarized text */
  text: z.string(),
  /** Original token count */
  originalTokens: z.number().int().nonnegative(),
  /** Compressed token count */
  compressedTokens: z.number().int().nonnegative(),
  /** Compression ratio achieved (0-1) */
  compressionRatio: z.number().min(0).max(1),
  /** Metadata about the compression */
  metadata: z.object({
    model: z.string(),
    method: z.enum(["longcodezip", "heuristic"]),
    processingTimeMs: z.number().nonnegative(),
  }),
});

export type SummarizeResult = z.infer<typeof SummarizeResultSchema>;

// =============================================================================
// Semantic Chunk
// =============================================================================

/**
 * A semantically coherent chunk of text identified by perplexity boundaries.
 */
export const SemanticChunkSchema = z.object({
  /** The chunk text content */
  text: z.string(),
  /** Starting line number (0-indexed) */
  startLine: z.number().int().nonnegative(),
  /** Ending line number (0-indexed, inclusive) */
  endLine: z.number().int().nonnegative(),
  /** Number of tokens in this chunk */
  tokenCount: z.number().int().positive(),
  /** Approximated Mutual Information score */
  ami: z.number().describe("Approximated Mutual Information score"),
  /** Cumulative perplexity of lines in this chunk */
  perplexity: z.number().nonnegative(),
});

export type SemanticChunk = z.infer<typeof SemanticChunkSchema>;

// =============================================================================
// LLM Structured Output Schema
// =============================================================================

/**
 * Schema for structured output from the LLM summarization call.
 */
export const LLMSummarizeOutputSchema = z.object({
  summary: z.string().describe("The summarized text"),
  keyPoints: z
    .array(z.string())
    .optional()
    .describe("Extracted key points if applicable"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in summary quality (0-1)"),
});

export type LLMSummarizeOutput = z.infer<typeof LLMSummarizeOutputSchema>;

// =============================================================================
// Environment Configuration
// =============================================================================

/**
 * Whether to run in offline mode (use fallback instead of Python backend).
 */
export const OFFLINE_MODE = process.env.ALFRED_SUMMARIZE_OFFLINE === "1";

/**
 * Default AMI sensitivity parameter (beta).
 */
export const DEFAULT_BETA = Number(process.env.ALFRED_SUMMARIZE_BETA) || 0.5;

/**
 * Default perplexity boundary threshold multiplier (k).
 */
export const DEFAULT_K = Number(process.env.ALFRED_SUMMARIZE_K) || 0.2;

/**
 * Default compression ratio.
 */
export const DEFAULT_RATIO = Number(process.env.ALFRED_SUMMARIZE_RATIO) || 0.5;
