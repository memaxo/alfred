import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createCacheSlice } from "./cache";
import { createContextSlice } from "./context";
import { createGraphSlice } from "./graph";
import { persistOptions } from "./persist";
import type { MindscapeState } from "./types";

export const useMindscapeStore = create<MindscapeState>()(
  persist(
    (...a) => ({
      ...createGraphSlice(...a),
      ...createCacheSlice(...a),
      ...createContextSlice(...a),
    }),
    persistOptions
  )
);

import { hasWindow } from "@/lib/env/isomorphic";

declare global {
  interface Window {
    __MINDSCAPE_STORE__?: typeof useMindscapeStore;
  }
}

if (hasWindow() && !window.__MINDSCAPE_STORE__) {
  window.__MINDSCAPE_STORE__ = useMindscapeStore;
}

export * from "./types";
export * from "./cache";
