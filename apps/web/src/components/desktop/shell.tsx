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

import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

import { OnboardingOverlay } from "../onboarding/overlay";
import { FocusIndicator, SkipLinks } from "./accessibility";
import { DesktopCommandPalette } from "./command-palette";
import { LayerErrorBoundary, ShellErrorBoundary } from "./error-boundary";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { DesktopIcons } from "./layers/desktop-icons";
import { MindscapeLayer } from "./layers/mindscape-layer";
import { OrbLayer } from "./layers/orb-layer";
import { WidgetLayer } from "./layers/widget-layer";
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

interface AlfredDesktopShellProps {
  children?: ReactNode;
  onWorkflowNavigate?: (runId: string) => void;
  onVisualize?: (windowId: string) => void;
  onAsk?: (windowId: string, label?: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AlfredDesktopShell({
  children,
  onWorkflowNavigate,
  onVisualize,
  onAsk,
}: AlfredDesktopShellProps) {
  const isTestMode =
    import.meta.env.VITE_TEST_MODE === "true" ||
    import.meta.env.MINDSCAPE_TEST === "1";

  const { mode, focusedWindowId, setDesktopArea } = useDesktopStore(
    useShallow((s) => ({
      mode: s.isSpaceMode ? "mindscape" : "desktop",
      focusedWindowId: s.focusedWindowId,
      setDesktopArea: s.setDesktopArea,
    }))
  );

  useKeyboardShortcuts();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Back online", { duration: 2000 });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Lost connection. Running in offline mode.", {
        duration: Number.POSITIVE_INFINITY,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    <ShellErrorBoundary>
      <div
        aria-label="Alfred Desktop"
        className="relative h-screen w-full overflow-hidden bg-void"
        data-testid="alfred-desktop-shell"
        role="application"
      >
        {/* Accessibility: Skip Links */}
        <SkipLinks />

        {/* Accessibility: Focus Indicator */}
        <FocusIndicator />

        {/* Background Layer */}
        <div
          className="absolute inset-0"
          data-layer="background"
          style={{ zIndex: Z_INDEX.BACKGROUND }}
        >
          {/* Desktop background - gradient or image */}
          <div
            className={cn(
              "h-full w-full bg-gradient-to-br transition-colors duration-1000",
              isOffline
                ? "from-red-950/20 via-void to-red-950/20"
                : "from-void via-void-surface to-void"
            )}
          />

          {/* Desktop Icons (on background surface) */}
          {mode === "desktop" && <DesktopIcons />}

          {/* Widget Layer (pinned charts/metrics) */}
          {mode === "desktop" && <WidgetLayer />}
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
          <main aria-label="Desktop windows" id="main-content">
            <LayerErrorBoundary layerName="Windows">
              <WindowLayer
                focusedWindowId={focusedWindowId}
                style={{ zIndex: Z_INDEX.WINDOWS_MIN }}
              />
            </LayerErrorBoundary>
          </main>
        )}

        {/* Menu Bar Layer */}
        <LayerErrorBoundary fallback={null} layerName="Menu Bar">
          <MenuBar style={{ zIndex: Z_INDEX.MENU_BAR }} />
        </LayerErrorBoundary>

        {/* Taskbar Layer */}
        <LayerErrorBoundary fallback={null} layerName="Taskbar">
          <Taskbar style={{ zIndex: Z_INDEX.TASKBAR }} />
        </LayerErrorBoundary>

        {/* Orb Layer */}
        {isTestMode ? null : <OrbLayer style={{ zIndex: Z_INDEX.ORB }} />}

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

        {/* Onboarding Overlay */}
        {isTestMode ? null : <OnboardingOverlay />}
      </div>
    </ShellErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default AlfredDesktopShell;
