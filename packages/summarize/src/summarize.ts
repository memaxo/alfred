/**
 * Main summarize API
 * Exposes high-level functions for text summarization using LongCodeZip
 */

import { SummarizeProcess } from "./process.js";
import type {
  AmiOptions,
  AmiResult,
  ChunkOptions,
  ChunkResult,
  SummarizeConfig,
  SummarizeOptions,
  SummarizeResult,
} from "./types.js";

// Singleton process instance
let _process: SummarizeProcess | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Check if Python/UV is available for LongCodeZip backend
 * Returns false if ALFRED_SUMMARIZE_OFFLINE=1 is set
 */
export function isPythonAvailable(): boolean {
  // Force offline mode via environment variable
  if (process.env.ALFRED_SUMMARIZE_OFFLINE === "1") {
    return false;
  }

  try {
    const uvCheck = Bun.spawnSync(["which", "uv"]);
    if (uvCheck.exitCode === 0) {
      return true;
    }
    const py3Check = Bun.spawnSync(["which", "python3"]);
    return py3Check.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Initialize the summarize process
 * Called automatically on first use, but can be called explicitly for preloading
 */
export async function initialize(config?: SummarizeConfig): Promise<void> {
  if (_process) {
    return;
  }

  if (_initPromise) {
    await _initPromise;
    return;
  }

  _initPromise = (async () => {
    _process = new SummarizeProcess(config);
    await _process.start();
  })();

  await _initPromise;
}

/**
 * Get the process instance, initializing if needed
 */
async function getProcess(config?: SummarizeConfig): Promise<SummarizeProcess> {
  if (!_process) {
    await initialize(config);
  }
  if (!_process) {
    throw new Error("Failed to initialize summarize process");
  }
  return _process;
}

/**
 * Summarize text using LongCodeZip compression
 *
 * @param text - Text to summarize
 * @param options - Summarization options
 * @returns Summarization result with compressed text and metadata
 *
 * @example
 * ```ts
 * const result = await summarize("Long document text...", {
 *   targetRatio: 0.3,
 *   instruction: "Focus on the main technical concepts"
 * });
 * console.log(result.text); // Compressed text
 * console.log(result.compressionRatio); // e.g., 0.28
 * ```
 */
export async function summarize(
  text: string,
  options: SummarizeOptions = {}
): Promise<SummarizeResult> {
  const startTime = performance.now();

  // Check if Python is available
  if (!isPythonAvailable()) {
    // Fall back to heuristic summarization
    return heuristicSummarize(text, options, startTime);
  }

  try {
    const proc = await getProcess();
    const result = await proc.compress(text, {
      instruction: options.instruction,
      targetRatio: options.targetRatio,
      targetTokens: options.targetTokens,
      useFineGrained: options.useFineGrained,
    });

    return {
      text: result.compressedText,
      originalTokens: result.originalTokens,
      compressedTokens: result.compressedTokens,
      compressionRatio: result.compressionRatio,
      metadata: {
        model: "Qwen/Qwen2.5-Coder-0.5B-Instruct",
        method: "longcodezip",
        processingTimeMs: performance.now() - startTime,
      },
    };
  } catch (_error) {
    return heuristicSummarize(text, options, startTime);
  }
}

/**
 * Chunk text using entropy-based semantic chunking
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Chunks with perplexity data
 */
export async function chunk(
  text: string,
  options: ChunkOptions = {}
): Promise<ChunkResult> {
  if (!isPythonAvailable()) {
    // Fall back to simple chunking
    return heuristicChunk(text, options);
  }

  try {
    const proc = await getProcess();
    return await proc.chunk(text, options);
  } catch (_error) {
    return heuristicChunk(text, options);
  }
}

/**
 * Calculate Approximated Mutual Information (AMI) between context and instruction
 *
 * AMI measures how much the context helps predict/understand the instruction.
 * Positive values indicate the context is relevant; negative values indicate it may confuse.
 *
 * @param context - Context text
 * @param options - AMI options with instruction
 * @returns AMI score
 */
export async function ami(
  context: string,
  options: AmiOptions
): Promise<AmiResult> {
  if (!isPythonAvailable()) {
    // Heuristic: estimate relevance based on word overlap
    return heuristicAmi(context, options);
  }

  try {
    const proc = await getProcess();
    const score = await proc.ami(context, options.instruction);
    return { score };
  } catch (_error) {
    return heuristicAmi(context, options);
  }
}

/**
 * Shutdown the summarize process
 * Call this when you're done using the summarizer to free resources
 */
export async function shutdown(): Promise<void> {
  if (_process) {
    await _process.shutdown();
    _process = null;
    _initPromise = null;
  }
}

/**
 * Get process health information
 */
export function getHealth() {
  if (!_process) {
    return null;
  }
  return _process.getHealth();
}

// =============================================================================
// Heuristic Fallbacks
// =============================================================================

/**
 * Heuristic summarization when Python is unavailable
 * Uses simple sentence extraction based on position and length
 */
function heuristicSummarize(
  text: string,
  options: SummarizeOptions,
  startTime: number
): SummarizeResult {
  const targetRatio = options.targetRatio ?? 0.5;
  const lines = text.split("\n").filter((l) => l.trim());

  // Estimate tokens (rough approximation: 4 chars per token)
  const estimateTokens = (s: string) => Math.ceil(s.length / 4);
  const originalTokens = estimateTokens(text);
  const targetTokens = Math.floor(originalTokens * targetRatio);

  // Score lines by position (first and last are important) and length
  const scored = lines.map((line, i) => {
    const positionScore = i === 0 ? 10 : i === lines.length - 1 ? 5 : 1;
    const lengthScore = Math.min(line.length / 100, 3);
    return { line, score: positionScore + lengthScore, index: i };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select lines until we hit target
  const selected: { line: string; index: number }[] = [];
  let currentTokens = 0;

  for (const item of scored) {
    const lineTokens = estimateTokens(item.line);
    if (currentTokens + lineTokens <= targetTokens) {
      selected.push(item);
      currentTokens += lineTokens;
    }
  }

  // Restore original order
  selected.sort((a, b) => a.index - b.index);
  const compressedText = selected.map((s) => s.line).join("\n");

  return {
    text: compressedText,
    originalTokens,
    compressedTokens: currentTokens,
    compressionRatio: currentTokens / originalTokens,
    metadata: {
      model: "heuristic",
      method: "heuristic",
      processingTimeMs: performance.now() - startTime,
    },
  };
}

/**
 * Heuristic chunking when Python is unavailable
 * Uses paragraph boundaries (double newlines) as chunk delimiters
 */
function heuristicChunk(text: string, _options: ChunkOptions): ChunkResult {
  // Split on double newlines
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter((c) => c);

  // No perplexity data available in heuristic mode
  return {
    chunks,
    spikeIndices: [],
    perplexities: [],
  };
}

/**
 * Heuristic AMI when Python is unavailable
 * Estimates relevance based on word overlap
 */
function heuristicAmi(context: string, options: AmiOptions): AmiResult {
  const contextWords = new Set(context.toLowerCase().match(/\b\w+\b/g) ?? []);
  const instructionWords =
    options.instruction.toLowerCase().match(/\b\w+\b/g) ?? [];

  if (instructionWords.length === 0) {
    return { score: 0 };
  }

  // Count how many instruction words appear in context
  const overlap = instructionWords.filter((w) => contextWords.has(w)).length;
  const overlapRatio = overlap / instructionWords.length;

  // Scale to a reasonable AMI-like range
  // Higher overlap = positive AMI (context is relevant)
  const score = (overlapRatio - 0.5) * 10;

  return { score };
}
