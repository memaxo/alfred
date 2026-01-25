/**
 * LRU cache for extraction results.
 * Improves performance for repeated extractions within agent sessions.
 */

import type { ExtractionResult } from "./types.js";

interface CacheEntry {
  result: ExtractionResult;
  expires: number;
}

/**
 * Simple LRU cache with TTL support.
 * Max 100 entries, 5 minute TTL.
 */
class ExtractionCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize = 100;
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from text hash
   */
  private getKey(text: string): string {
    // Simple hash function for cache key
    let hash = 0;
    const normalized = text.trim().toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.codePointAt(i) ?? 0;
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached result if available and not expired
   */
  get(text: string): ExtractionResult | null {
    const key = this.getKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  /**
   * Store result in cache
   */
  set(text: string, result: ExtractionResult): void {
    const key = this.getKey(text);

    // Remove if exists
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      expires: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
const cache = new ExtractionCache();

// Periodic cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cache.cleanup();
  }, 60 * 1000);
}

/**
 * Get cached extraction result or null
 */
export function getCachedExtraction(text: string): ExtractionResult | null {
  return cache.get(text);
}

/**
 * Cache extraction result
 */
export function cacheExtraction(text: string, result: ExtractionResult): void {
  cache.set(text, result);
}

/**
 * Clear extraction cache
 */
export function clearExtractionCache(): void {
  cache.clear();
}
