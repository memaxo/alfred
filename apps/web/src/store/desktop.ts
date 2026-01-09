import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createCacheSlice } from "./desktop/cache";
import { createContextSlice } from "./desktop/context";
import { createGroupSlice } from "./desktop/groups";
import { createKnowledgeSlice } from "./desktop/knowledge";
import { persistOptions } from "./desktop/persist";
import { createTaskbarSlice } from "./desktop/taskbar";
import { createTilingSlice } from "./desktop/tiling";
import type { DesktopState } from "./desktop/types.new";
import { createViewportSliceNew } from "./desktop/viewport.new";
import { createWindowSliceNew } from "./desktop/windows.new";

export const useDesktopStore = create<DesktopState>()(
  persist(
    (...a) => ({
      ...createWindowSliceNew(...a),
      ...createGroupSlice(...a),
      ...createViewportSliceNew(...a),
      ...createTilingSlice(...a),
      ...createTaskbarSlice(...a),
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

export * from "./desktop/types.new";
