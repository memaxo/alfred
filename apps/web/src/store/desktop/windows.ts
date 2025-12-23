import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { StateCreator } from "zustand";
import { getLayoutedElements, getSemanticLayoutedElements } from "@/lib/layout";
import type { DesktopState, WindowData, WindowSlice } from "./types";

export const createWindowSlice: StateCreator<
  DesktopState,
  [],
  [],
  WindowSlice
> = (set, get) => ({
  windows: [],
  edges: [],
  activeEdges: new Set(),
  highlightedEdgeIds: new Set(),

  onNodesChange: (changes) => {
    set({
      windows: applyNodeChanges(
        changes,
        get().windows
      ) as DesktopState["windows"],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges) as DesktopState["edges"],
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addWindow: (window) => {
    set((state) => {
      if (state.windows.some((w) => w.id === window.id)) {
        return state;
      }
      return { windows: [...state.windows, window] };
    });
  },

  removeWindow: (windowId) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== windowId),
      edges: state.edges.filter(
        (e) => e.source !== windowId && e.target !== windowId
      ),
    }));
  },

  updateWindow: (windowId, data) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return {
          ...w,
          data: { ...w.data, ...data } as WindowData,
        };
      }),
    }));
  },

  setWindows: (windowsOrUpdater) => {
    set((state) => {
      const newWindows =
        typeof windowsOrUpdater === "function"
          ? windowsOrUpdater(state.windows)
          : windowsOrUpdater;
      return { windows: newWindows };
    });
  },

  setEdges: (edges) => {
    set((state) => {
      if (edges.length === state.edges.length) {
        const allMatch = edges.every((e, i) => e.id === state.edges[i]?.id);
        if (allMatch) {
          return state;
        }
      }
      return { edges };
    });
  },

  setHighlightedEdges: (edgeIds) => {
    set({ highlightedEdgeIds: new Set(edgeIds) });
  },

  triggerEdgeActivity: (edgeId, durationMs = 2000) => {
    set((state) => {
      const next = new Set(state.activeEdges);
      next.add(edgeId);
      return { activeEdges: next };
    });

    setTimeout(() => {
      set((state) => {
        const next = new Set(state.activeEdges);
        next.delete(edgeId);
        return { activeEdges: next };
      });
    }, durationMs);
  },

  autoLayout: () => {
    const { windows, edges, focusedWindowId } = get();
    const shouldUseSemantic =
      edges.length > 0 || windows.some((w) => Boolean(w.data?.resourceRef));
    const layoutedWindows = shouldUseSemantic
      ? getSemanticLayoutedElements(windows as any, edges, {
          focusId: focusedWindowId,
        })
      : getLayoutedElements(windows as any, edges);
    set({ windows: layoutedWindows as DesktopState["windows"] });
  },
});
