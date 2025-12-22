import type { PersistOptions } from "zustand/middleware";
import type { MindscapeState } from "./types";
import type { ArtifactData, ChatNodeData } from "../mindscape.schemas";

export function sanitizeNodeForPersist(node: any): any {
  const sanitizedData = sanitizeNodeData(node);
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    dragging: false,
    data: sanitizedData,
    draggable: node.draggable,
    height: node.height,
    width: node.width,
    selectable: node.selectable,
  };
}

function sanitizeNodeData(node: any): ArtifactData {
  const data = (node.data ??
    ({ label: node.id } as ArtifactData)) as ArtifactData;

  if (
    node.type === "chat" &&
    "messages" in data &&
    Array.isArray((data as ChatNodeData).messages)
  ) {
    const trimmed = (data as ChatNodeData).messages?.slice(-10);
    return { ...data, messages: trimmed } as ArtifactData;
  }

  return data;
}

export const persistOptions: PersistOptions<MindscapeState> = {
  name: "mindscape-storage-v2",
  partialize: (state) => ({
    nodes: state.nodes.map(sanitizeNodeForPersist) as any,
    edges: state.edges as any,
    isSpaceMode: state.isSpaceMode,
    focusedNodeId: state.focusedNodeId,
    ragDocCache: state.ragDocCache,
    ragDocCacheStats: state.ragDocCacheStats,
    contextCache: state.contextCache,
    feedbackByNode: state.feedbackByNode,
  } as any),
  version: 2,
  // Add migration logic if needed in future versions
  migrate: (persistedState: any, version: number) => {
    if (version === 1) {
      // Handle migration from v1 to v2 if necessary
    }
    return persistedState as MindscapeState;
  },
};
