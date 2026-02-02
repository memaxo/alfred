/**
 * Focus Mode - Distraction-free productivity mode
 *
 * Features:
 * - Expands focused window to fullscreen
 * - Minimizes all other windows
 * - Adds vignette overlay for immersion
 * - Disables notifications
 * - Keyboard shortcut: Cmd+F
 *
 * @see docs/execplans/desktop-evolution-prd.md Part IV - Creative Ideas
 */

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface FocusModeOverlayProps {
  className?: string;
}

export function FocusModeOverlay({ className }: FocusModeOverlayProps) {
  const { isFocusMode, focusedWindowId, exitFocusMode, windows } =
    useDesktopStore(
      useShallow((s) => ({
        isFocusMode: s.isFocusMode,
        focusedWindowId: s.focusedWindowId,
        exitFocusMode: s.exitFocusMode,
        windows: s.windows,
      }))
    );

  // Get the focused window
  const focusedWindow = useMemo(() => {
    if (!focusedWindowId) {
      return null;
    }
    return windows.find((w) => w.id === focusedWindowId);
  }, [focusedWindowId, windows]);

  // Handle exit
  const handleExit = useCallback(() => {
    exitFocusMode();
  }, [exitFocusMode]);

  // Escape key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) {
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode, handleExit]);

  if (!isFocusMode || !focusedWindow) {
    return null;
  }

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-[500]", className)}
      data-focus-mode="active"
    >
      {/* Vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top bar with exit button */}
      <div className="pointer-events-auto absolute top-0 right-0 left-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-biolum text-sm">Focus Mode</span>
          {focusedWindow.data?.label && (
            <span className="text-biolum-dim text-sm">
              — {focusedWindow.data.label}
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-biolum text-sm backdrop-blur-sm transition-colors hover:bg-white/20"
          onClick={handleExit}
          type="button"
        >
          <X className="h-3 w-3" />
          Exit Focus
        </button>
      </div>

      {/* Bottom hint */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-4 py-2 text-biolum-dim text-xs backdrop-blur-sm">
        Press ESC to exit focus mode
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseFocusModeReturn {
  isFocusMode: boolean;
  focusedWindowId: string | null;
  enterFocusMode: (windowId: string) => void;
  exitFocusMode: () => void;
  toggleFocusMode: (windowId?: string) => void;
}

export function useFocusMode(): UseFocusModeReturn {
  const { isFocusMode, focusedWindowId, enterFocusMode, exitFocusMode } =
    useDesktopStore(
      useShallow((s) => ({
        isFocusMode: s.isFocusMode,
        focusedWindowId: s.focusedWindowId,
        enterFocusMode: s.enterFocusMode,
        exitFocusMode: s.exitFocusMode,
      }))
    );

  const toggleFocusMode = useCallback(
    (windowId?: string) => {
      if (isFocusMode) {
        exitFocusMode();
      } else if (windowId) {
        enterFocusMode(windowId);
      }
    },
    [isFocusMode, enterFocusMode, exitFocusMode]
  );

  return {
    isFocusMode,
    focusedWindowId,
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode,
  };
}

export default FocusModeOverlay;
