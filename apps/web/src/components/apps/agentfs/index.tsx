"use client";

/**
 * AgentFS Viewer Application - Phase 3 System Application
 *
 * View audit trail of AgentFS operations, checkpoints, and KV store.
 *
 * Features:
 * - Workspace list
 * - Call timeline
 * - File audit panel
 * - Checkpoint browser
 * - KV viewer
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.7
 */

import { Database, FolderGit2, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CallTimeline } from "./call-timeline";
import { CheckpointBrowser } from "./checkpoint-browser";
import { FileAudit } from "./file-audit";
import { KVViewer } from "./kv-viewer";
import { WorkspaceList } from "./workspace-list";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AgentFSAppProps = {
  windowId?: string;
  className?: string;
};

export type Workspace = {
  id: string;
  runId: string;
  dbPath: string;
  agentType: string;
  status: string;
  createdAt: string;
  operationCount: number;
  checkpointCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AgentFSApp({
  windowId: _windowId,
  className,
}: AgentFSAppProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [tab, setTab] = useState<"timeline" | "files" | "checkpoints" | "kv">(
    "timeline"
  );

  const selectedWorkspaceId = selectedWorkspace?.id ?? null;

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="agentfs"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">AgentFS Viewer</span>
        </div>

        <Button className="h-7 w-7" size="icon" variant="ghost">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Workspace List */}
        <WorkspaceList
          className="w-72 flex-shrink-0 border-white/5 border-r"
          onSelect={setSelectedWorkspace}
          selectedId={selectedWorkspaceId}
        />

        {/* Detail Panel */}
        {selectedWorkspaceId ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-white/5 border-b">
              <TabButton
                active={tab === "timeline"}
                label="Timeline"
                onClick={() => setTab("timeline")}
              />
              <TabButton
                active={tab === "files"}
                label="Files"
                onClick={() => setTab("files")}
              />
              <TabButton
                active={tab === "checkpoints"}
                label="Checkpoints"
                onClick={() => setTab("checkpoints")}
              />
              <TabButton
                active={tab === "kv"}
                label="KV Store"
                onClick={() => setTab("kv")}
              />
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {tab === "timeline" && selectedWorkspace && (
                <CallTimeline
                  className="h-full"
                  workspace={selectedWorkspace}
                />
              )}
              {tab === "files" && selectedWorkspace && (
                <FileAudit className="h-full" workspace={selectedWorkspace} />
              )}
              {tab === "checkpoints" && selectedWorkspace && (
                <CheckpointBrowser
                  className="h-full"
                  workspace={selectedWorkspace}
                />
              )}
              {tab === "kv" && selectedWorkspace && (
                <KVViewer className="h-full" workspace={selectedWorkspace} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-biolum-dim">
            <div className="text-center">
              <Database className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Select a workspace</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "border-b-2 px-4 py-2 text-sm transition-colors",
        active
          ? "border-biolum text-biolum"
          : "border-transparent text-biolum-dim hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function AgentFSAppWindow(props: WindowComponentProps) {
  return <AgentFSApp className="h-full" windowId={props.window.id} />;
}

export default AgentFSApp;
