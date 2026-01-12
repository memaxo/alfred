import { create } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import { createCacheSlice } from "./desktop/cache";
import { createContextSlice } from "./desktop/context";
import { createGroupSlice } from "./desktop/groups";
import { createDesktopIconSlice, type DesktopIconSlice } from "./desktop/icons";
import { createKnowledgeSlice } from "./desktop/knowledge";
import { createMenuSlice, type MenuSlice } from "./desktop/menus";
import { persistOptions } from "./desktop/persist";
import { createTaskbarSlice } from "./desktop/taskbar";
import { createTilingSlice } from "./desktop/tiling";
import type { DesktopState } from "./desktop/types.new";
import { createViewportSliceNew } from "./desktop/viewport.new";
import { createWidgetSlice } from "./desktop/widgets";
import { createWindowSliceNew } from "./desktop/windows.new";

type FullDesktopState = DesktopState & DesktopIconSlice & MenuSlice;

export const useDesktopStore = create<FullDesktopState>()(
  persist(
    (set, get, store) => ({
      ...createWindowSliceNew(set as never, get as never, store as never),
      ...createGroupSlice(set as never, get as never, store as never),
      ...createViewportSliceNew(set as never, get as never, store as never),
      ...createTilingSlice(set as never, get as never, store as never),
      ...createTaskbarSlice(set as never, get as never, store as never),
      ...createWidgetSlice(set as never),
      ...createCacheSlice(set as never, get as never, store as never),
      ...createContextSlice(set as never, get as never, store as never),
      ...createKnowledgeSlice(set as never, get as never, store as never),
      ...createDesktopIconSlice(set as never, get as never),
      ...createMenuSlice(set as never, get as never),
    }),
    persistOptions as unknown as PersistOptions<FullDesktopState>
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
