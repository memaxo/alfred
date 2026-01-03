/**
 * Global Keyboard Shortcuts Hook
 *
 * Handles global keyboard shortcuts for the desktop shell.
 *
 * Shortcuts:
 * - Cmd+K: Open command palette
 * - Cmd+W: Close focused window
 * - Cmd+M: Minimize focused window
 * - Cmd+Tab: Cycle focus between windows
 * - Cmd+`: Toggle Mindscape mode
 * - Cmd+1-9: Focus window by position
 * - Arrow keys (when holding Cmd): Directional focus
 * - Escape: Close overlays, unfocus
 */

import { useCallback, useEffect } from "react";
import { useDesktopStore } from "@/store/desktop";

type ShortcutHandler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts() {
  const {
    focusedWindowId,
    windows,
    removeWindow,
    focusWindow,
    setSpaceMode,
    isSpaceMode,
  } = useDesktopStore((s) => ({
    focusedWindowId: s.focusedWindowId,
    windows: s.windows,
    removeWindow: s.removeWindow,
    focusWindow: s.focusWindow,
    setSpaceMode: s.setSpaceMode,
    isSpaceMode: s.isSpaceMode,
  }));

  const handleKeyDown: ShortcutHandler = useCallback(
    (e) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+K: Open command palette (handled by command palette itself)
      // Just prevent default to ensure it works
      if (isMeta && e.key === "k") {
        // Command palette handles this
        return;
      }

      // Cmd+W: Close focused window
      if (isMeta && e.key === "w") {
        e.preventDefault();
        if (focusedWindowId) {
          removeWindow(focusedWindowId);
        }
        return;
      }

      // Cmd+`: Toggle Mindscape mode
      if (isMeta && e.key === "`") {
        e.preventDefault();
        setSpaceMode(!isSpaceMode);
        return;
      }

      // Cmd+Tab: Cycle focus between windows
      if (isMeta && e.key === "Tab") {
        e.preventDefault();
        if (windows.length === 0) {
          return;
        }

        const currentIndex = windows.findIndex((w) => w.id === focusedWindowId);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + windows.length) % windows.length
          : (currentIndex + 1) % windows.length;

        const nextWindow = windows[nextIndex];
        if (nextWindow) {
          focusWindow(nextWindow.id);
        }
        return;
      }

      // Cmd+1-9: Focus window by position
      if (isMeta && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = Number.parseInt(e.key, 10) - 1;
        const window = windows[index];
        if (window) {
          focusWindow(window.id);
        }
        return;
      }

      // Escape: Clear focus / close overlays
      if (e.key === "Escape") {
        // Let command palette handle its own escape
        // If nothing else handles it, clear focus
        return;
      }

      // Arrow keys with Cmd: Directional focus navigation
      if (
        isMeta &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        // Directional focus will be implemented with tiling
        // For now, just cycle through windows
        return;
      }
    },
    [
      focusedWindowId,
      windows,
      removeWindow,
      focusWindow,
      setSpaceMode,
      isSpaceMode,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
