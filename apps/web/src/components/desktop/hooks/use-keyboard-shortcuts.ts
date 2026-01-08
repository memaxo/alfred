"use client";

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
    tileWindow,
    maximizeWindow,
    minimizeWindow,
    untileWindow,
  } = useDesktopStore((s) => ({
    focusedWindowId: s.focusedWindowId,
    windows: s.windows,
    removeWindow: s.removeWindow,
    focusWindow: s.focusWindow,
    setSpaceMode: s.setSpaceMode,
    isSpaceMode: s.isSpaceMode,
    tileWindow: s.tileWindow,
    maximizeWindow: s.maximizeWindow,
    minimizeWindow: s.minimizeWindow,
    untileWindow: s.untileWindow,
  }));

  const handleKeyDown: ShortcutHandler = useCallback(
    (e) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === "k") {
        return;
      }

      if (isMeta && e.key === "w") {
        e.preventDefault();
        if (focusedWindowId) {
          removeWindow(focusedWindowId);
        }
        return;
      }

      if (isMeta && e.key === "`") {
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

      if (
        isMeta &&
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
          case "ArrowDown":
            minimizeWindow(focusedWindowId);
            break;
        }
        return;
      }

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
      untileWindow,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
