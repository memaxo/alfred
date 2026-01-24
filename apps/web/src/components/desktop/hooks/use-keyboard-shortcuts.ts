"use client";

import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

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
    tileWindow,
    maximizeWindow,
    minimizeWindow,
    restoreWindow,
    untileWindow,
  } = useDesktopStore(
    useShallow((s) => ({
      focusedWindowId: s.focusedWindowId,
      windows: s.windows,
      removeWindow: s.removeWindow,
      focusWindow: s.focusWindow,
      setSpaceMode: s.setSpaceMode,
      isSpaceMode: s.isSpaceMode,
      tileWindow: s.tileWindow,
      maximizeWindow: s.maximizeWindow,
      minimizeWindow: s.minimizeWindow,
      restoreWindow: s.restoreWindow,
      untileWindow: s.untileWindow,
    }))
  );

  const handleKeyDown: ShortcutHandler = useCallback(
    (e) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+K - Command palette (let it bubble)
      if (isMeta && e.key === "k") {
        return;
      }

      // Cmd+W - Close focused window
      if (isMeta && e.key === "w") {
        e.preventDefault();
        if (focusedWindowId) {
          removeWindow(focusedWindowId);
        }
        return;
      }

      // Cmd+Q - Quit/close focused app (same as Cmd+W for desktop)
      if (isMeta && e.key === "q") {
        e.preventDefault();
        if (focusedWindowId) {
          removeWindow(focusedWindowId);
        }
        return;
      }

      // Cmd+H - Hide/minimize focused window
      if (isMeta && e.key === "h") {
        e.preventDefault();
        if (focusedWindowId) {
          minimizeWindow(focusedWindowId);
        }
        return;
      }

      // Mindscape toggle: Cmd+M or Cmd+` (per PRD)
      if (isMeta && (e.key === "m" || e.key === "`")) {
        e.preventDefault();
        setSpaceMode(!isSpaceMode);
        return;
      }

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

      if (isMeta && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = Number.parseInt(e.key, 10) - 1;
        const window = windows[index];
        if (window) {
          focusWindow(window.id);
        }
        return;
      }

      // Cmd+Arrows - Tiling and Maximize/Restore
      if (
        isMeta &&
        !e.shiftKey &&
        !e.altKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        if (!focusedWindowId) {
          return;
        }

        switch (e.key) {
          case "ArrowLeft":
            tileWindow(focusedWindowId, "left");
            break;
          case "ArrowRight":
            tileWindow(focusedWindowId, "right");
            break;
          case "ArrowUp":
            maximizeWindow(focusedWindowId);
            break;
          case "ArrowDown": {
            const win = windows.find((w) => w.id === focusedWindowId);
            if (win?.state === "maximized") {
              restoreWindow(focusedWindowId);
            } else {
              minimizeWindow(focusedWindowId);
            }
            break;
          }
        }
        return;
      }

      // Cmd+Shift+Arrows - Quadrant Tiling
      if (isMeta && e.shiftKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        if (!focusedWindowId) {
          return;
        }

        const win = windows.find((w) => w.id === focusedWindowId);
        const isTop =
          win?.tileZone?.includes("top") || !win?.tileZone?.includes("bottom");

        if (e.key === "ArrowLeft") {
          tileWindow(focusedWindowId, isTop ? "top-left" : "bottom-left");
        } else {
          tileWindow(focusedWindowId, isTop ? "top-right" : "bottom-right");
        }
        return;
      }

      // Cmd+Escape - Untile focused window
      if (isMeta && e.key === "Escape") {
        e.preventDefault();
        if (focusedWindowId) {
          const window = windows.find((w) => w.id === focusedWindowId);
          if (window?.isTiled) {
            untileWindow(focusedWindowId);
          }
        }
        return;
      }

      // Ctrl+Arrow - Navigate between tiled windows (focus direction)
      if (
        e.ctrlKey &&
        !e.metaKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const tiledWindows = windows.filter((w) => w.isTiled);
        if (tiledWindows.length === 0) {
          return;
        }

        const focusedWindow = windows.find((w) => w.id === focusedWindowId);
        if (!focusedWindow?.isTiled) {
          // Focus first tiled window if none focused
          const first = tiledWindows[0];
          if (first) {
            focusWindow(first.id);
          }
          return;
        }

        // Find adjacent window based on tile zone
        const direction = e.key.replace("Arrow", "").toLowerCase();
        const currentZone = focusedWindow.tileZone;

        let targetZone: string | null = null;
        if (direction === "left" && currentZone === "right") {
          targetZone = "left";
        } else if (direction === "right" && currentZone === "left") {
          targetZone = "right";
        } else if (direction === "up") {
          // Look for top zones
          if (currentZone === "bottom-left") {
            targetZone = "top-left";
          } else if (currentZone === "bottom-right") {
            targetZone = "top-right";
          }
        } else if (direction === "down") {
          // Look for bottom zones
          if (currentZone === "top-left") {
            targetZone = "bottom-left";
          } else if (currentZone === "top-right") {
            targetZone = "bottom-right";
          }
        }

        if (targetZone) {
          const targetWindow = tiledWindows.find(
            (w) => w.tileZone === targetZone
          );
          if (targetWindow) {
            focusWindow(targetWindow.id);
          }
        }
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
      tileWindow,
      maximizeWindow,
      minimizeWindow,
      restoreWindow,
      untileWindow,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
