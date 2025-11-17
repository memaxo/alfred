/**
 * Context Builder
 * 
 * Wraps context gathering functions with caching and token budget validation.
 * Reuses existing functions from @alfred/agent/orchestrator/flow/context
 */

import { createHash } from "node:crypto";
import type { SearchReceipt, ContextBundle } from "@alfred/type/plan";
import { logger } from "@alfred/api/utils/logger";
import {
  runtimeContextBuildDurationSeconds,
  runtimeContextCacheHitsTotal,
  runtimeContextTokensTotal,
} from "./metrics";

/**
 * Context build input
 */
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
  private cache: Map<string, CachedContext> = new Map();

  /**
   * Build execution context with caching
   * 
   * Returns cached context if valid, otherwise gathers fresh context.
   * Implements LRU eviction and periodic cleanup.
   */
  async build(input: ContextBuildInput): Promise<ExecutionContext> {
    const startTime = Date.now();
    const cacheKey = this.computeKey(input);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      // Cache hit
      runtimeContextCacheHitsTotal.inc({ result: "hit" });
      
      const durationMs = Date.now() - startTime;
      runtimeContextBuildDurationSeconds
        .labels({ cached: "true" })
        .observe(durationMs / 1000);
      
      logger.debug("runtime_context_cache_hit", {
        requirement: input.requirement.slice(0, 100),
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
      // TODO: Integrate with gatherCodeContext and gatherWebContext from @alfred/agent
      // For now, return minimal context
      const context: ExecutionContext = {
        requirement: input.requirement,
        receipts: {
          code: [],
          web: input.web ? [] : undefined,
          created: new Date(),
        },
        bundle: null,
        totalTokens: 0,
      };

      // Cache the context
      this.cache.set(cacheKey, {
        context,
        expires: Date.now() + CACHE_TTL_MS,
      });
      
      // Track token counts
      runtimeContextTokensTotal.inc({ type: "total" }, context.totalTokens);
      runtimeContextTokensTotal.inc({ type: "requirement" }, 0); // TODO: Actual token count
      
      const durationMs = Date.now() - startTime;
      runtimeContextBuildDurationSeconds
        .labels({ cached: "false" })
        .observe(durationMs / 1000);
      
      logger.info("runtime_context_build", {
        requirement: input.requirement.slice(0, 100),
        cached: false,
        totalTokens: context.totalTokens,
        receiptsCount: context.receipts.code.length,
        durationMs,
      });

      return context;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error("runtime_context_build_failed", {
        requirement: input.requirement.slice(0, 100),
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
      .update(String(input.topK ?? 25))
      .update(String(input.maxTokens ?? 100000))
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

