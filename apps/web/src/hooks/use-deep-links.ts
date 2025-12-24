/**
 * Deep Link Navigation Hook for Mindscape.
 *
 * Handles URL-based navigation via search params:
 * - ?nodeId=... - Focus existing node
 * - ?spawn=... - Spawn new node
 * - ?ragDoc=... - Navigate to RAG document
 */

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { hasWindow } from "@/lib/env/isomorphic";
import { clearSearchParams } from "@/lib/mindscape/url";
import { useMindscapeStore } from "@/store/mindscape";
import {
  createSpawnNode,
  formatSpawnLabel,
  type MindscapeSearchParams,
  type MindscapeSpawnType,
  singletonSpawnTypes,
} from "@/components/mindscape/spawn";
import { windowTypes as nodeTypes } from "@/components/windows/registry";

export type UseDeepLinksOptions = {
  searchParams?: MindscapeSearchParams;
  onFocusAndCenter: (nodeId: string) => void;
  onRagDocNavigate?: (documentId: string) => void;
};

export type UseDeepLinksResult = {
  spawnNodeFromType: (spawnType: MindscapeSpawnType) => string | null;
  handleNavigateToRagDoc: (documentId: string) => void;
};

export function useDeepLinks({
  searchParams,
  onFocusAndCenter,
  onRagDocNavigate,
}: UseDeepLinksOptions): UseDeepLinksResult {
  const { nodes, addArtifact } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      addArtifact: state.addArtifact,
    }))
  );

  const nodeIdQuery = searchParams?.nodeId;
  const spawnQuery = searchParams?.spawn;
  const ragDocFocusCooldownRef = useRef<{ id: string | null; at: number }>({
    id: null,
    at: 0,
  });

  // Spawn a node from type
  const spawnNodeFromType = useCallback(
    (spawnType: MindscapeSpawnType): string | null => {
      if (!(spawnType in nodeTypes)) {
        toast.info(`${formatSpawnLabel(spawnType)} node is not available yet.`);
        return null;
      }

      if (singletonSpawnTypes.includes(spawnType)) {
        const existing = nodes.find((node) => node.type === spawnType);
        if (existing) {
          onFocusAndCenter(existing.id);
          return existing.id;
        }
      }

      const newNode = createSpawnNode(spawnType, nodes.length);
      if (!newNode) {
        toast.error(`Unable to spawn ${formatSpawnLabel(spawnType)} yet.`);
        return null;
      }

      addArtifact(newNode);
      onFocusAndCenter(newNode.id);
      return newNode.id;
    },
    [nodes, addArtifact, onFocusAndCenter]
  );

  // Navigate to RAG document with cooldown
  const handleNavigateToRagDoc = useCallback(
    (documentId: string) => {
      if (!documentId) {
        return;
      }
      const now = Date.now();
      const last = ragDocFocusCooldownRef.current;
      if (last.id === documentId && now - last.at < 600) {
        return;
      }
      ragDocFocusCooldownRef.current = { id: documentId, at: now };
      if (onRagDocNavigate) {
        onRagDocNavigate(documentId);
        return;
      }
      if (hasWindow()) {
        const url = new URL(window.location.href);
        url.searchParams.set("ragDoc", documentId);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    },
    [onRagDocNavigate]
  );

  // Deep link focus (?nodeId=...)
  useEffect(() => {
    if (!nodeIdQuery) {
      return;
    }

    const target = nodes.find((node) => node.id === nodeIdQuery);
    if (!target) {
      return;
    }

    onFocusAndCenter(nodeIdQuery);
    clearSearchParams(["nodeId"]);
  }, [nodeIdQuery, nodes, onFocusAndCenter]);

  // Spawn nodes via deep link (?spawn=...)
  useEffect(() => {
    if (!spawnQuery) {
      return;
    }

    spawnNodeFromType(spawnQuery);
    clearSearchParams(["spawn"]);
  }, [spawnQuery, spawnNodeFromType]);

  return {
    spawnNodeFromType,
    handleNavigateToRagDoc,
  };
}
