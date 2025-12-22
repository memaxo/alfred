import type { StateCreator } from "zustand";
import { queueRagCacheMetric } from "@/lib/mindscape/telemetry";
import type { MindscapeState } from "./types";

const resolvePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

export const RAG_DOC_CACHE_LIMIT = resolvePositiveNumber(
  import.meta.env?.VITE_MINDSCAPE_RAG_CACHE_LIMIT,
  50
);

export const RAG_DOC_CACHE_TTL_MS = resolvePositiveNumber(
  import.meta.env?.VITE_MINDSCAPE_RAG_CACHE_TTL_MS,
  5 * 60 * 1000
);

export const createCacheSlice: StateCreator<MindscapeState, [], [], Pick<MindscapeState, "ragDocCache" | "ragDocCacheStats" | "cacheRagDoc" | "evictRagDoc" | "recordRagDocCacheHit" | "recordRagDocCacheMiss">> = (set) => ({
  ragDocCache: {},
  ragDocCacheStats: {
    hits: 0,
    misses: 0,
    evictions: 0,
  },

  cacheRagDoc: (dbId, data) => {
    if (!dbId) {
      return;
    }
    set((state) => {
      const now = Date.now();
      const next = {
        ...state.ragDocCache,
        [dbId]: {
          data,
          cachedAt: now,
        },
      };

      let evictions = 0;
      for (const key of Object.keys(next)) {
        const entry = next[key];
        if (!entry) {
          continue;
        }
        if (now - entry.cachedAt > RAG_DOC_CACHE_TTL_MS) {
          delete next[key];
          evictions += 1;
        }
      }

      const keys = Object.keys(next);
      if (keys.length > RAG_DOC_CACHE_LIMIT) {
        keys
          .sort(
            (a, b) => (next[a]?.cachedAt ?? 0) - (next[b]?.cachedAt ?? 0)
          )
          .slice(0, keys.length - RAG_DOC_CACHE_LIMIT)
          .forEach((key) => {
            delete next[key];
            evictions += 1;
          });
      }

      if (evictions > 0) {
        queueRagCacheMetric("eviction", evictions);
      }

      return {
        ragDocCache: next,
        ragDocCacheStats: {
          ...state.ragDocCacheStats,
          evictions: state.ragDocCacheStats.evictions + evictions,
        },
      };
    });
  },

  evictRagDoc: (dbId) => {
    if (!dbId) {
      return;
    }
    set((state) => {
      if (!state.ragDocCache[dbId]) {
        return state;
      }
      const next = { ...state.ragDocCache };
      delete next[dbId];
      queueRagCacheMetric("eviction");
      return {
        ragDocCache: next,
        ragDocCacheStats: {
          ...state.ragDocCacheStats,
          evictions: state.ragDocCacheStats.evictions + 1,
        },
      };
    });
  },

  recordRagDocCacheHit: () => {
    set((state) => ({
      ragDocCacheStats: {
        ...state.ragDocCacheStats,
        hits: state.ragDocCacheStats.hits + 1,
      },
    }));
    queueRagCacheMetric("hit");
  },

  recordRagDocCacheMiss: () => {
    set((state) => ({
      ragDocCacheStats: {
        ...state.ragDocCacheStats,
        misses: state.ragDocCacheStats.misses + 1,
      },
    }));
    queueRagCacheMetric("miss");
  },
});
