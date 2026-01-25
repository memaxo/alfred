/**
 * TypeScript types for the summarize package
 */

/** Configuration for the summarize process */
export interface SummarizeConfig {
  /** Model name for compression (default: Qwen/Qwen2.5-Coder-0.5B-Instruct) */
  modelName?: string;
  /** Device to run on: auto, cpu, cuda, mps (default: auto) */
  device?: string;
  /** Log level for Python process (default: INFO) */
  logLevel?: string;
  /** Request timeout in ms (default: 120000) */
  requestTimeout?: number;
}

/** Process health status */
export interface ProcessHealth {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
  status: "idle" | "busy" | "error";
  lastActive: number;
}

/** Request to Python subprocess */
export interface CompressRequest {
  id: string;
  type: "compress" | "chunk" | "ami" | "ping";
  payload: Record<string, unknown>;
}

/** Response from Python subprocess */
export interface CompressResponse {
  id: string;
  type: "result" | "error" | "ready" | "pong";
  payload: {
    error?: string;
    compressed_text?: string;
    original_tokens?: number;
    compressed_tokens?: number;
    compression_ratio?: number;
    chunks?: string[];
    spike_indices?: number[];
    perplexities?: number[];
    ami_score?: number;
    status?: string;
  };
}

/** Options for summarize() function */
export interface SummarizeOptions {
  /** Instruction/query for relevance scoring */
  instruction?: string;
  /** Target compression ratio (0-1) */
  targetRatio?: number;
  /** Target token count (overrides ratio if > 0) */
  targetTokens?: number;
  /** Use fine-grained block-level compression */
  useFineGrained?: boolean;
  /** Style hint for summarization */
  style?: "concise" | "detailed" | "technical" | "conversational";
}

/** Result from summarize() function */
export interface SummarizeResult {
  /** Compressed/summarized text */
  text: string;
  /** Original token count */
  originalTokens: number;
  /** Compressed token count */
  compressedTokens: number;
  /** Compression ratio achieved */
  compressionRatio: number;
  /** Metadata about the compression */
  metadata: {
    model: string;
    method: "longcodezip" | "heuristic";
    processingTimeMs: number;
  };
}

/** Options for chunk() function */
export interface ChunkOptions {
  /** Method for spike detection: std, robust_std, iqr, mad */
  method?: "std" | "robust_std" | "iqr" | "mad";
  /** Threshold multiplier (default: 0.2) */
  k?: number;
}

/** Result from chunk() function */
export interface ChunkResult {
  /** Semantic chunks */
  chunks: string[];
  /** Indices where perplexity spikes occurred */
  spikeIndices: number[];
  /** Perplexity values for each line */
  perplexities: number[];
}

/** Options for ami() function */
export interface AmiOptions {
  /** Instruction/query for AMI calculation */
  instruction: string;
}

/** Result from ami() function */
export interface AmiResult {
  /** AMI score (positive = context helps, negative = context hurts) */
  score: number;
}
