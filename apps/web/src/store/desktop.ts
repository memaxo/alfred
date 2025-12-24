import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createCacheSlice } from "./desktop/cache";
import { createContextSlice } from "./desktop/context";
import { createDockSlice } from "./desktop/dock";
import { createKnowledgeSlice } from "./desktop/knowledge";
import { persistOptions } from "./desktop/persist";
import type { DesktopState } from "./desktop/types";
import { createViewportSlice } from "./desktop/viewport";
import { createWindowSlice } from "./desktop/windows";

export const useDesktopStore = create<DesktopState>()(
  persist(
    (...a) => ({
      ...createWindowSlice(...a),
      ...createViewportSlice(...a),
      ...createDockSlice(...a),
      ...createCacheSlice(...a),
      ...createContextSlice(...a),
      ...createKnowledgeSlice(...a),
    }),
    persistOptions
  )
);

import { hasWindow } from "@/lib/env/isomorphic";

declare global {
  // biome-ignore lint/nursery/useConsistentTypeDefinitions: declaration merging requires interface
  interface Window {
    __DESKTOP_STORE__?: typeof useDesktopStore;
  }
}

if (hasWindow() && !window.__DESKTOP_STORE__) {
  window.__DESKTOP_STORE__ = useDesktopStore;
}

export * from "./desktop/types";
