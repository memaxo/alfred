"use client";

/**
 * Alfred Desktop Shell - Phase 1 Foundation
 *
 * The primary container orchestrating all desktop layers with z-ordering.
 * Uses Phase 0 types without ReactFlow dependency for window management.
 *
 * Layer Architecture:
 * - Overlay Layer (z: 2000) - Modals, dialogs, command palette
 * - Menu Bar Layer (z: 1000) - Top menu bar
 * - Taskbar Layer (z: 1000) - Bottom taskbar
 * - Orb Layer (z: 900) - Voice orb
 * - Window Layer (z: 100-500) - Tiled/floating windows
 * - Mindscape Layer (z: 50) - ReactFlow canvas (toggle)
 * - Background (z: 0) - Desktop background
 *
 * @see docs/execplans/desktop-evolution-prd.md Part II
 */

import { type ReactNode, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDesktopStore } from "@/store/desktop";
import { DesktopCommandPalette } from "./command-palette";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { MindscapeLayer } from "./layers/mindscape-layer";
import { OrbLayer } from "./layers/orb-layer";
import { WindowLayer } from "./layers/window-layer";
import { MenuBar } from "./menubar";
import { Taskbar } from "./taskbar";

// ─────────────────────────────────────────────────────────────────────────────
// Z-INDEX CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const Z_INDEX = {
  BACKGROUND: 0,
  MINDSCAPE: 50,
  WINDOWS_MIN: 100,
  WINDOWS_MAX: 500,
  ORB: 900,
  MENU_BAR: 1000,
  TASKBAR: 1000,
  OVERLAY: 2000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AlfredDesktopShellProps = {
  children?: ReactNode;
  onWorkflowNavigate?: (runId: string) => void;
  onVisualize?: (windowId: string) => void;
  onAsk?: (windowId: string, label?: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AlfredDesktopShell({
  children,
  onWorkflowNavigate,
  onVisualize,
  onAsk,
}: AlfredDesktopShellProps) {
  const { mode, focusedWindowId, setDesktopArea } = useDesktopStore(
    useShallow((s) => ({
      mode: s.isSpaceMode ? "mindscape" : "desktop",
      focusedWindowId: s.focusedWindowId,
      setDesktopArea: s.setDesktopArea,
    }))
  );

  useKeyboardShortcuts();

  useEffect(() => {
    const updateDesktopArea = () => {
      const area = {
        x: 0,
        y: 32,
        width: window.innerWidth,
        height: window.innerHeight - 32 - 48,
      };
      setDesktopArea(area);
    };

    updateDesktopArea();
    window.addEventListener("resize", updateDesktopArea);
    return () => window.removeEventListener("resize", updateDesktopArea);
  }, [setDesktopArea]);

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-void"
      data-testid="alfred-desktop-shell"
    >
      {/* Background Layer */}
      <div
        className="absolute inset-0"
        data-layer="background"
        style={{ zIndex: Z_INDEX.BACKGROUND }}
      >
        {/* Desktop background - gradient or image */}
        <div className="h-full w-full bg-gradient-to-br from-void via-void-surface to-void" />
      </div>

      {/* Mindscape Layer (ReactFlow - toggle) */}
      {mode === "mindscape" && (
        <MindscapeLayer
          onWorkflowNavigate={onWorkflowNavigate}
          style={{ zIndex: Z_INDEX.MINDSCAPE }}
        />
      )}

      {/* Window Layer (Traditional DOM windows) */}
      {mode === "desktop" && (
        <WindowLayer
          focusedWindowId={focusedWindowId}
          style={{ zIndex: Z_INDEX.WINDOWS_MIN }}
        />
      )}

      {/* Menu Bar Layer */}
      <MenuBar style={{ zIndex: Z_INDEX.MENU_BAR }} />

      {/* Taskbar Layer */}
      <Taskbar style={{ zIndex: Z_INDEX.TASKBAR }} />

      {/* Orb Layer */}
      <OrbLayer style={{ zIndex: Z_INDEX.ORB }} />

      {/* Overlay Layer (Command Palette, Modals) */}
      <div
        className="pointer-events-none absolute inset-0"
        data-layer="overlay"
        style={{ zIndex: Z_INDEX.OVERLAY }}
      >
        <DesktopCommandPalette onAsk={onAsk} onVisualize={onVisualize} />
      </div>

      {/* Additional children (portals, etc.) */}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default AlfredDesktopShell;
