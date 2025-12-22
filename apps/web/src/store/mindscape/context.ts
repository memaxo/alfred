import type { StateCreator } from "zustand";
import type { MindscapeState } from "./types";

export const createContextSlice: StateCreator<MindscapeState, [], [], Pick<MindscapeState, "contextCache" | "feedbackByNode" | "recordContextReceipt" | "clearContextReceipt" | "recordFeedback">> = (set) => ({
  contextCache: {},
  feedbackByNode: {},

  recordContextReceipt: (nodeId, entry) => {
    if (!nodeId) {
      return;
    }
    set((state) => ({
      contextCache: {
        ...state.contextCache,
        [nodeId]: {
          ...(state.contextCache[nodeId] ?? {}),
          ...entry,
          updatedAt: Date.now(),
        },
      },
    }));
  },

  clearContextReceipt: (nodeId) => {
    if (!nodeId) {
      return;
    }
    set((state) => {
      if (!state.contextCache[nodeId]) {
        return state;
      }
      const next = { ...state.contextCache };
      delete next[nodeId];
      return { contextCache: next };
    });
  },

  recordFeedback: (nodeId, intent) => {
    if (!nodeId) {
      return;
    }
    set((state) => ({
      feedbackByNode: {
        ...state.feedbackByNode,
        [nodeId]: { intent, updatedAt: Date.now() },
      },
    }));
  },
});
