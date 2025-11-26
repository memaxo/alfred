/**
 * Context Builder
 *
 * Wraps context gathering functions with caching and token budget validation.
 * Reuses existing functions from @alfred/agent/orchestrator/flow/context
 */

import { createHash } from "node:crypto";
import {
  buildContextBundle,
  gatherCodeContext,
  gatherWebContext,
} from "@alfred/agent/orchestrator/flow/context";
import { createTokenEstimator } from "@alfred/agent/orchestrator/util/token";
import { logger } from "@alfred/logger";
import type { ContextBundle, SearchReceipt } from "@alfred/type/plan";
import { KnowledgeEngine } from "./engines/knowledge";
import {
  runtimeContextBuildDurationSeconds,
  runtimeContextCacheHitsTotal,
  runtimeContextTokensTotal,
  runtimeRagRetrievalDurationSeconds,
  runtimeRagRetrievalTotal,
} from "./metrics";

/**
 * Context build input
 */
type ContextWriter = {
  write: (chunk: unknown) => Promise<void> | void;
};

export type ContextBuildInput = {
  requirement: string;
  workspace?: string;
  repoBase?: string;
  web?: boolean;
  topK?: number;
  maxTokens?: number;
  exts?: string[];
  ignore?: string[];
  seeds?: string[];
  authz?: string;
};

/**
 * Execution context
 */
export type ExecutionContext = {
  requirement: string;
  receipts: SearchReceipt;
  bundle: ContextBundle | null;
  totalTokens: number;
  ragChunks?: import("@alfred/rag").Chunk[];
  ragDocumentIds?: string[];
};

/**
 * Cached context entry
 */
type CachedContext = {
  context: ExecutionContext;
  expires: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 100; // LRU eviction threshold
const DEFAULT_MAX_TOKENS = 24_000; // Default token budget for context
const DEFAULT_TOP_K = 25; // Default number of code files to retrieve
const RAG_TOP_K = 5; // Number of RAG chunks to retrieve
const RAG_THRESHOLD = 0.7; // Minimum similarity score for RAG chunks
const REQUIREMENT_SLICE_LENGTH = 100; // Length to slice requirement for logging
const MS_TO_SECONDS = 1000; // Conversion factor from milliseconds to seconds

/**
 * ContextBuilder manages context gathering with caching
 *
 * Delegates to existing gatherCodeContext/gatherWebContext functions.
 * Provides token budget validation.
 *
 * Memory-bounded: Uses LRU eviction when cache exceeds MAX_CACHE_ENTRIES.
 * Periodically evicts expired entries to prevent unbounded growth.
 */
export class ContextBuilder {
  private readonly cache: Map<string, CachedContext> = new Map();

  /**
   * Build execution context with caching
   *
   * Returns cached context if valid, otherwise gathers fresh context.
   * Implements LRU eviction and periodic cleanup.
   */
  async build(
    input: ContextBuildInput,
    overrides?: {
      receipts?: SearchReceipt;
      writer?: ContextWriter;
    }
  ): Promise<ExecutionContext> {
    const startTime = Date.now();
    const cacheKey = this.computeKey(input);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      // Cache hit
      runtimeContextCacheHitsTotal.inc({ result: "hit" });

      const durationMs = Date.now() - startTime;
      runtimeContextBuildDurationSeconds
        .labels({ cached: "true" })
        .observe(durationMs / MS_TO_SECONDS);

      logger.debug("runtime_context_cache_hit", {
        requirement: input.requirement.slice(0, REQUIREMENT_SLICE_LENGTH),
        cached: true,
        durationMs,
      });

      // LRU: Move to end (most recently used)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.context;
    }

    // Cache miss
    runtimeContextCacheHitsTotal.inc({ result: "miss" });

    // Evict expired entries before building
    this.evictExpired();

    // LRU: Evict oldest entry if at capacity
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        logger.debug("runtime_context_cache_eviction", {
          reason: "capacity",
          maxEntries: MAX_CACHE_ENTRIES,
        });
      }
    }

    try {
      // Build fresh context
      const resolvedWorkspace = input.workspace ?? process.cwd();

      let receipts: SearchReceipt | null = overrides?.receipts ?? null;

      if (!receipts) {
        const codeReceipt = await gatherCodeContext({
          requirement: input.requirement,
          cw: resolvedWorkspace,
          exts: input.exts,
          ignore: input.ignore,
          topK: input.topK ?? DEFAULT_TOP_K,
          authz: input.authz,
        });

        const webReceipt = input.web
          ? await gatherWebContext({
              requirement: input.requirement,
              authz: input.authz,
            })
          : null;

        receipts = {
          code: codeReceipt.code,
          web: webReceipt?.web,
          created: new Date(),
          summary: [codeReceipt.summary, webReceipt?.summary]
            .filter(Boolean)
            .join(" | ")
            .slice(0, 500),
        } as SearchReceipt;
      }

      if (!receipts) {
        throw new Error("context_receipts_unavailable");
      }

      const resolvedReceipts = receipts;

      // Build context bundle
      const bundle = await buildContextBundle({
        cw: resolvedWorkspace,
        receipts: resolvedReceipts,
        maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
        writer: overrides?.writer,
      });

      // Retrieve RAG chunks for semantic context (disabled in tests to avoid heavy dependencies)
      let ragChunks: import("@alfred/rag").Chunk[] | undefined;
      let ragTokens = 0;

      if (process.env.NODE_ENV !== "test") {
        const ragStartTime = Date.now();
        try {
          const knowledgeEngine = new KnowledgeEngine();
          ragChunks = await knowledgeEngine.retrieveContext(input.requirement, {
            useHybrid: true,
            topK: RAG_TOP_K,
            threshold: RAG_THRESHOLD,
            useReranking: false,
          });

          // Estimate RAG chunk tokens
          if (ragChunks.length > 0) {
            const estimator = createTokenEstimator();
            ragTokens = ragChunks.reduce(
              (sum, chunk) => sum + estimator.estimate(chunk.content),
              0
            );
          }

          const ragDurationMs = Date.now() - ragStartTime;
          runtimeRagRetrievalDurationSeconds.observe(
            ragDurationMs / MS_TO_SECONDS
          );
          runtimeRagRetrievalTotal.inc({ status: "ok" });

          logger.debug("runtime_rag_retrieval", {
            requirement: input.requirement.slice(0, REQUIREMENT_SLICE_LENGTH),
            chunksCount: ragChunks.length,
            tokens: ragTokens,
            durationMs: ragDurationMs,
          });
        } catch (error) {
          // RAG retrieval is non-fatal - continue without chunks
          const ragDurationMs = Date.now() - ragStartTime;
          runtimeRagRetrievalTotal.inc({ status: "error" });
          logger.warn("runtime_rag_retrieval_failed", {
            requirement: input.requirement.slice(0, REQUIREMENT_SLICE_LENGTH),
            error: error instanceof Error ? error.message : String(error),
            durationMs: ragDurationMs,
          });
          ragChunks = undefined;
        }
      }

      // Derive provenance: which RAG documents contributed chunks
      let ragDocumentIds: string[] | undefined;
      if (ragChunks && ragChunks.length > 0) {
        const ids = new Set<string>();
        for (const chunk of ragChunks) {
          const metadata = (chunk as any)?.metadata as
            | Record<string, unknown>
            | undefined;
          const docId = metadata?.documentId;
          if (typeof docId === "string" && docId.length > 0) {
            ids.add(docId);
          }
        }
        if (ids.size > 0) {
          ragDocumentIds = Array.from(ids);
        }
      }

      // Calculate total tokens
      const totalTokens = (bundle?.estimatedTokens ?? 0) + ragTokens;

      const context: ExecutionContext = {
        requirement: input.requirement,
        receipts: resolvedReceipts,
        bundle,
        totalTokens,
        ragChunks,
        ragDocumentIds,
      };

      // Cache the context
      this.cache.set(cacheKey, {
        context,
        expires: Date.now() + CACHE_TTL_MS,
      });

      // Track token counts
      runtimeContextTokensTotal.inc({ type: "total" }, totalTokens);
      runtimeContextTokensTotal.inc(
        { type: "context" },
        bundle?.estimatedTokens ?? 0
      );
      runtimeContextTokensTotal.inc({ type: "rag" }, ragTokens);

      const durationMs = Date.now() - startTime;
      runtimeContextBuildDurationSeconds
        .labels({ cached: "false" })
        .observe(durationMs / MS_TO_SECONDS);

      logger.info("runtime_context_build", {
        requirement: input.requirement.slice(0, REQUIREMENT_SLICE_LENGTH),
        cached: false,
        totalTokens,
        receiptsCount: receipts.code.length,
        bundleFiles: bundle?.files.length ?? 0,
        ragChunks: ragChunks?.length ?? 0,
        durationMs,
      });

      return context;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error("runtime_context_build_failed", {
        requirement: input.requirement.slice(0, REQUIREMENT_SLICE_LENGTH),
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
      throw error;
    }
  }

  /**
   * Compute cache key from input parameters
   *
   * Hash of all parameters that affect context gathering
   */
  private computeKey(input: ContextBuildInput): string {
    return createHash("sha256")
      .update(input.requirement)
      .update(input.workspace ?? "")
      .update((input.exts ?? []).join(","))
      .update((input.ignore ?? []).join(","))
      .update(String(input.topK ?? DEFAULT_TOP_K))
      .update(String(input.maxTokens ?? DEFAULT_MAX_TOKENS))
      .update(String(input.web ?? false))
      .digest("hex");
  }

  /**
   * Clear all cached contexts
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Evict expired cache entries
   *
   * Called before each build to prevent unbounded growth
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get maximum cache capacity
   */
  getMaxCapacity(): number {
    return MAX_CACHE_ENTRIES;
  }
}
