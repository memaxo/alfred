/**
 * Compatibility layer for migrating from mindscape to desktop store.
 * Re-exports desktop store functions with mindscape-compatible names.
 */

import { useDesktopStore } from "./desktop";
import type { DesktopEdge, WindowData, WindowInstance } from "./desktop/types";

// Re-export desktop store as mindscape-compatible alias
export const useMindscapeStore = useDesktopStore;

// Type aliases for compatibility
export type ArtifactNode = WindowInstance;
export type ArtifactData = WindowData;
export type ArtifactEdge = DesktopEdge;

// Action aliases
export function useArtifactActions() {
  const addWindow = useDesktopStore((s) => s.addWindow);
  const removeWindow = useDesktopStore((s) => s.removeWindow);
  const updateWindow = useDesktopStore((s) => s.updateWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  return {
    addArtifact: addWindow,
    removeArtifact: removeWindow,
    updateArtifactData: (id: string, data: Partial<WindowData>) =>
      updateWindow(id, data),
    focusNode: focusWindow,
  };
}
