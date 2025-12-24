import type { StateCreator } from "zustand";
import type {
  DesktopEdge,
  DesktopState,
  EdgeData,
  WindowInstance,
} from "./types";

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
  spawnKnowledgeGraph: (nodes, edges, centerPosition) => {
    if (nodes.length === 0) {
      return [];
    }

    const { viewport, windows: existingWindows } = get();
    const center = centerPosition ?? {
      x: -viewport.x + 600,
      y: -viewport.y + 400,
    };

    // Map old IDs to new window IDs
    const idMap = new Map<string, string>();

    // Position nodes in a radial layout around center
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
    const baseRadius = 200;

    const newWindows: WindowInstance[] = nodes.map((node, index) => {
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
      } as WindowInstance;
    }).filter(Boolean);

    // Create edges using mapped IDs
    const newEdges: DesktopEdge[] = edges
      .map((edge) => {
        const sourceId = idMap.get(edge.fromId);
        const targetId = idMap.get(edge.toId);
        if (!sourceId || !targetId) {
          return null;
        }
        return {
          id: `edge-${edge.id}`,
          source: sourceId,
          target: targetId,
          type: "default",
          data: {
            kind: edge.kind as EdgeData["kind"],
            metadata: {
              source: "inference" as const,
              confidence: edge.weight,
              createdAt: new Date().toISOString(),
            },
          },
        } as DesktopEdge;
      })
      .filter((e): e is DesktopEdge => e !== null);

    set((state) => ({
      windows: [...state.windows, ...newWindows],
      edges: [...state.edges, ...newEdges],
    }));

    // Auto-layout after spawning
    setTimeout(() => {
      get().autoLayout();
    }, 50);

    return newWindows.map((w) => w.id);
  },
});
