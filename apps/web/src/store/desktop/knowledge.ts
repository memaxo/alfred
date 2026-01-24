import type { StateCreator } from "zustand";

import type { DesktopState, WindowInstance } from "./types.new";

export type KnowledgeNode = {
  id: string;
  label: string;
  entityType?: string;
  confidence?: number;
  archived?: string;
  description?: string;
  hgHash?: string;
};

export type KnowledgeEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
};

export type KnowledgeSlice = {
  spawnKnowledgeGraph: (
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    centerPosition?: { x: number; y: number }
  ) => string[];
};

export const createKnowledgeSlice: StateCreator<
  DesktopState,
  [],
  [],
  KnowledgeSlice
> = (set, get) => ({
  spawnKnowledgeGraph: (nodes, _edges, centerPosition) => {
    if (nodes.length === 0) {
      return [];
    }

    const { desktopArea, windows: existingWindows } = get();
    const center = centerPosition ?? {
      x: desktopArea.x + desktopArea.width / 2,
      y: desktopArea.y + desktopArea.height / 2,
    };

    // Map old IDs to new window IDs
    const idMap = new Map<string, string>();

    // Position nodes in a radial layout around center
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
    const baseRadius = 200;

    const newWindows: WindowInstance[] = nodes
      .map((node, index) => {
        const windowId = `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        idMap.set(node.id, windowId);

        // Skip existing windows with same hgHash
        const existing = existingWindows.find(
          (w) =>
            w.data?.type === "knowledge" &&
            (w.data as { hgHash?: string }).hgHash === node.hgHash
        );
        if (existing) {
          idMap.set(node.id, existing.id);
          return null as unknown as WindowInstance;
        }

        const angle = index * angleStep - Math.PI / 2;
        const radius = baseRadius + (index % 3) * 60;

        return {
          id: windowId,
          type: "knowledge" as const,
          position: {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
          },
          bounds: {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
            width: 400,
            height: 300,
          },
          state: "normal" as const,
          isTiled: false,
          zIndex: 0,
          isFocused: false,
          minSize: { width: 200, height: 150 },
          resizable: true,
          createdAt: Date.now(),
          lastFocusedAt: Date.now(),
          data: {
            type: "knowledge" as const,
            label: node.label,
            viewMode: "full" as const,
            resourceRef: {
              type: "knowledge" as const,
              id: node.id,
            },
            kind: node.entityType ?? "fact",
            confidence: node.confidence,
            archived: node.archived ? true : undefined,
            summary: node.description,
            hgHash: node.hgHash,
          },
        } as unknown as WindowInstance;
      })
      .filter(Boolean);

    set((state) => ({
      windows: [...state.windows, ...newWindows],
    }));

    return newWindows.map((w) => w.id);
  },
});
