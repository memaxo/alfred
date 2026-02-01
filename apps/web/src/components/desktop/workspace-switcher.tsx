"use client";

/**
 * Workspace Switcher - Visual workspace indicator and selector
 *
 * Displays 6 workspace buttons (1-6) in the menubar.
 * Active workspace is highlighted. Workspaces with windows
 * show a subtle indicator.
 *
 * @see docs/execplans/desktop-critical-features-implementation.md Milestone 1
 */

import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useDesktopStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      activeWorkspaceId: s.activeWorkspaceId,
      switchWorkspace: s.switchWorkspace,
    }))
  );

  return (
    <div className="flex items-center gap-0.5">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        const hasWindows = workspace.windowIds.length > 0;

        return (
          <button
            key={workspace.id}
            aria-label={`Switch to workspace ${workspace.id}`}
            aria-pressed={isActive}
            className={cn(
              // Base styles
              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium transition-all",
              // Active state - filled
              isActive && [
                "bg-biolum text-void",
                "shadow-[0_0_8px_rgba(255,255,255,0.3)]",
              ],
              // Inactive state
              !isActive && [
                "text-biolum-dim hover:bg-white/10 hover:text-biolum",
                // Show dot indicator if workspace has windows
                hasWindows && "relative",
              ]
            )}
            onClick={() => switchWorkspace(workspace.id)}
            title={
              workspace.label
                ? `${workspace.label} (Workspace ${workspace.id})`
                : `Workspace ${workspace.id}${hasWindows ? ` (${workspace.windowIds.length} windows)` : ""}`
            }
            type="button"
          >
            {workspace.id}
            {/* Window indicator dot for inactive workspaces with windows */}
            {!isActive && hasWindows && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-biolum/60" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE INDICATOR (Simpler version for compact spaces)
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceIndicator() {
  const { activeWorkspaceId, workspaces } = useDesktopStore(
    useShallow((s) => ({
      activeWorkspaceId: s.activeWorkspaceId,
      workspaces: s.workspaces,
    }))
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const windowCount = activeWorkspace?.windowIds.length ?? 0;

  return (
    <div className="flex items-center gap-2 rounded bg-white/5 px-2 py-1">
      <span className="font-medium text-biolum text-xs">
        Desktop {activeWorkspaceId}
      </span>
      {windowCount > 0 && (
        <span className="text-biolum-dim text-[10px]">({windowCount})</span>
      )}
    </div>
  );
}
