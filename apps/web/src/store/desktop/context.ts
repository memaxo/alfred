import type { SearchReceipt } from "@alfred/type";
import type { StateCreator } from "zustand";
import type { DesktopState } from "./types";

export type ContextCacheEntry = {
  receipt?: SearchReceipt;
  phase?: "cache" | "scan" | "web" | "bundle";
  source?: "cache" | "handoff" | "scan";
  updatedAt: number;
};

export type FeedbackIntent = "positive" | "negative";

export type FeedbackEntry = {
  intent: FeedbackIntent;
  updatedAt: number;
};

export type ContextSlice = {
  contextCache: Record<string, ContextCacheEntry>;
  feedbackByWindow: Record<string, FeedbackEntry>;

  recordContextReceipt: (
    windowId: string,
    entry: Partial<Omit<ContextCacheEntry, "updatedAt">> & {
      receipt?: SearchReceipt;
    }
  ) => void;
  clearContextReceipt: (windowId: string) => void;
  recordFeedback: (windowId: string, intent: FeedbackIntent) => void;
};

export const createContextSlice: StateCreator<
  DesktopState,
  [],
  [],
  ContextSlice
> = (set) => ({
  contextCache: {},
  feedbackByWindow: {},

  recordContextReceipt: (windowId, entry) => {
    if (!windowId) {
      return;
    }
    set((state) => ({
      contextCache: {
        ...state.contextCache,
        [windowId]: {
          ...(state.contextCache[windowId] ?? {}),
          ...entry,
          updatedAt: Date.now(),
        },
      },
    }));
  },

  clearContextReceipt: (windowId) => {
    if (!windowId) {
      return;
    }
    set((state) => {
      if (!state.contextCache[windowId]) {
        return state;
      }
      const next = { ...state.contextCache };
      delete next[windowId];
      return { contextCache: next };
    });
  },

  recordFeedback: (windowId, intent) => {
    if (!windowId) {
      return;
    }
    set((state) => ({
      feedbackByWindow: {
        ...state.feedbackByWindow,
        [windowId]: { intent, updatedAt: Date.now() },
      },
    }));
  },
});
