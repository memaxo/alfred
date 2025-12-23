/**
 * RAG Document Cache Hook for Mindscape.
 *
 * Manages RAG document caching, hydration, and cache statistics.
 * Extracts cache logic from canvas.tsx for better separation of concerns.
 */

import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import type { NodeIdRef } from "@/lib/mindscape/graph";
import { clearSearchParams } from "@/lib/mindscape/url";
import {
  type ArtifactData,
  type KnowledgeNodeData,
  RAG_DOC_CACHE_TTL_MS,
  useMindscapeStore,
} from "@/store/mindscape";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type GraphNode = RouterOutputs["graph"]["runQuery"]["nodes"][number];

export type UseRagCacheOptions = {
  ragDocQuery: string | null;
  onHydrated?: (nodeId: string) => void;
};

export type UseRagCacheResult = {
  ragDocTargetNode: ReturnType<typeof useMindscapeStore.getState>["nodes"][number] | null;
  cachedRagDoc: KnowledgeNodeData | undefined;
  ragDocCacheEntryCount: number;
  ragDocCacheHitRate: number;
  ragDocCacheStats: { hits: number; misses: number; evictions: number };
  isHydrating: boolean;
};

export function useRagCache({
  ragDocQuery,
  onHydrated,
}: UseRagCacheOptions): UseRagCacheResult {
  const {
    nodes,
    ragDocCache,
    cacheRagDoc,
    evictRagDoc,
    recordRagDocCacheHit,
    recordRagDocCacheMiss,
    ragDocCacheStats,
    addArtifact,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      ragDocCache: state.ragDocCache,
      cacheRagDoc: state.cacheRagDoc,
      evictRagDoc: state.evictRagDoc,
      recordRagDocCacheHit: state.recordRagDocCacheHit,
      recordRagDocCacheMiss: state.recordRagDocCacheMiss,
      ragDocCacheStats: state.ragDocCacheStats,
      addArtifact: state.addArtifact,
    }))
  );

  // Find existing node for the RAG doc
  const ragDocTargetNode = useMemo(() => {
    if (!ragDocQuery) {
      return null;
    }
    return nodes.find((node) => node.data?.graph?.dbId === ragDocQuery) ?? null;
  }, [nodes, ragDocQuery]);

  // Check cache for the document
  const cachedEntry = ragDocQuery ? ragDocCache[ragDocQuery] : undefined;
  const cachedRagDoc =
    cachedEntry && Date.now() - cachedEntry.cachedAt < RAG_DOC_CACHE_TTL_MS
      ? cachedEntry.data
      : undefined;

  // Track cache hit/miss recording to avoid duplicates
  const lastCacheRecordRef = useRef<{
    id: string;
    outcome: "hit" | "miss";
  } | null>(null);

  // Record cache hits/misses
  useEffect(() => {
    if (!ragDocQuery) {
      lastCacheRecordRef.current = null;
      return;
    }
    const outcome: "hit" | "miss" | null = cachedRagDoc
      ? "hit"
      : ragDocTargetNode
        ? null
        : "miss";
    if (!outcome) {
      return;
    }
    const prev = lastCacheRecordRef.current;
    if (prev && prev.id === ragDocQuery && prev.outcome === outcome) {
      return;
    }
    if (outcome === "hit") {
      recordRagDocCacheHit();
    } else {
      recordRagDocCacheMiss();
    }
    lastCacheRecordRef.current = { id: ragDocQuery, outcome };
  }, [
    cachedRagDoc,
    ragDocQuery,
    ragDocTargetNode,
    recordRagDocCacheHit,
    recordRagDocCacheMiss,
  ]);

  // Dev-only cache stats logging
  const lastLoggedStatsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    if (typeof process !== "undefined" && process.env.BUN_TEST === "1") {
      return;
    }
    if (!ragDocCacheStats) {
      return;
    }
    const snapshot = `${ragDocCacheStats.hits}-${ragDocCacheStats.misses}-${ragDocCacheStats.evictions}`;
    if (snapshot === lastLoggedStatsRef.current) {
      return;
    }
    lastLoggedStatsRef.current = snapshot;
  }, [ragDocCacheStats]);

  // Determine if we need to hydrate from the graph
  const shouldHydrateRagDoc = Boolean(
    ragDocQuery && !ragDocTargetNode && !cachedRagDoc
  );

  // Query input for hydration
  const ragDocQueryInput =
    ragDocQuery && shouldHydrateRagDoc
      ? {
          kind: "traverse" as const,
          nodeId: ragDocQuery,
          direction: "both" as const,
          resource: "user",
          limit: 1,
        }
      : {
          kind: "traverse" as const,
          nodeId: "noop",
          direction: "both" as const,
          resource: "user",
          limit: 1,
        };

  const { data: ragDocGraph, isError: ragDocGraphError, isFetching } =
    trpc.graph.runQuery.useQuery(ragDocQueryInput, {
      enabled: shouldHydrateRagDoc,
      retry: 1,
    });

  // Evict stale cache entries
  useEffect(() => {
    if (cachedEntry && !cachedRagDoc && ragDocQuery) {
      evictRagDoc(ragDocQuery);
    }
  }, [cachedEntry, cachedRagDoc, evictRagDoc, ragDocQuery]);

  // Hydrate from cached data
  useEffect(() => {
    if (!(ragDocQuery && cachedRagDoc) || ragDocTargetNode) {
      return;
    }
    const derivedId = `rag-knowledge-${ragDocQuery}`;
    const exists = nodes.find((node) => node.id === derivedId);
    if (!exists) {
      addArtifact({
        id: derivedId,
        type: "knowledge",
        position: { x: 100, y: 100 },
        data: {
          ...cachedRagDoc,
          type: "knowledge",
          graph: {
            resource: cachedRagDoc.graph?.resource ?? "user",
            dbId: ragDocQuery,
            hgHash: cachedRagDoc.graph?.hgHash,
          },
          source: "rag",
        } as ArtifactData,
      });
    }
    onHydrated?.(exists?.id ?? derivedId);
    clearSearchParams(["ragDoc"]);
  }, [
    addArtifact,
    cachedRagDoc,
    nodes,
    onHydrated,
    ragDocQuery,
    ragDocTargetNode,
  ]);

  // Handle hydration errors
  useEffect(() => {
    if (!(ragDocQuery && ragDocGraphError)) {
      return;
    }
    toast.error("Unable to load RAG document. Please retry.");
    if (!ragDocTargetNode) {
      clearSearchParams(["ragDoc"]);
    }
  }, [ragDocGraphError, ragDocQuery, ragDocTargetNode]);

  // Hydrate from graph query result
  useEffect(() => {
    if (!ragDocQuery || ragDocTargetNode) {
      return;
    }
    if (!ragDocGraph || ragDocGraph.nodes.length === 0) {
      return;
    }
    const docNode = (ragDocGraph.nodes as GraphNode[]).find((node) => {
      const id = (node.id ?? {}) as NodeIdRef;
      return (
        id.dbId === ragDocQuery ||
        id.hgHash === ragDocQuery ||
        id.uiId === ragDocQuery
      );
    });
    if (!docNode) {
      toast.info("RAG document is not available in the graph yet.");
      clearSearchParams(["ragDoc"]);
      return;
    }

    const docNodeId = docNode.id as NodeIdRef;
    const props = (docNode.properties ?? {}) as Record<string, unknown>;
    const summary =
      typeof props.content === "string" ? props.content : undefined;
    const docDbId = docNodeId.dbId ?? ragDocQuery;
    const derivedId = `rag-knowledge-${docDbId}`;

    const exists = nodes.find((node) => node.id === derivedId);
    if (!exists) {
      const knowledgeData: KnowledgeNodeData = {
        type: "knowledge",
        label: docNode.label || "RAG Context",
        kind: docNode.kind,
        summary,
        source: "rag",
        graph: {
          resource: "user",
          dbId: docDbId,
          hgHash: docNodeId.hgHash,
        },
      };
      addArtifact({
        id: derivedId,
        type: "knowledge",
        position: { x: 100, y: 100 },
        data: knowledgeData as ArtifactData,
      });
      cacheRagDoc(docDbId, knowledgeData);
    }

    onHydrated?.(exists?.id ?? derivedId);
    clearSearchParams(["ragDoc"]);
  }, [
    addArtifact,
    cacheRagDoc,
    nodes,
    onHydrated,
    ragDocGraph,
    ragDocQuery,
    ragDocTargetNode,
  ]);

  // Compute cache statistics
  const ragDocCacheEntryCount = useMemo(
    () => Object.keys(ragDocCache).length,
    [ragDocCache]
  );
  const ragDocCacheLookupCount =
    ragDocCacheStats.hits + ragDocCacheStats.misses;
  const ragDocCacheHitRate =
    ragDocCacheLookupCount > 0
      ? Math.round((ragDocCacheStats.hits / ragDocCacheLookupCount) * 100)
      : 0;

  return {
    ragDocTargetNode,
    cachedRagDoc,
    ragDocCacheEntryCount,
    ragDocCacheHitRate,
    ragDocCacheStats,
    isHydrating: isFetching,
  };
}
