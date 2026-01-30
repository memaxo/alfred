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

import { skipToken } from "@tanstack/react-query";
import {
  Archive,
  Clock,
  Copy,
  Database,
  FolderGit2,
  Hash,
  Layers,
  Package,
  RefreshCw,
  Pin,
  PinOff,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { CallTimeline } from "./call-timeline";
import { CheckpointBrowser } from "./checkpoint-browser";
import { FileAudit } from "./file-audit";
import { KVViewer } from "./kv-viewer";
import { RunCompare } from "./run-compare";
import { WorkspaceList } from "./workspace-list";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AgentFSAppProps {
  windowId?: string;
  className?: string;
}

export interface Workspace {
  id: string;
  runId: string;
  dbPath: string;
  projectId: string | null;
  agentType: string;
  status: string;
  createdAt: string;
  operationCount: number;
  checkpointCount: number;
  pinned: boolean;
  retentionDays: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AgentFSApp({
  windowId: _windowId,
  className,
}: AgentFSAppProps) {
  const utils = trpc.useUtils();
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExportingCas, setIsExportingCas] = useState(false);
  const [isRestoringCas, setIsRestoringCas] = useState(false);
  const [tab, setTab] = useState<
    "timeline" | "files" | "compare" | "checkpoints" | "kv"
  >("timeline");

  const { data: statsData } = trpc.agentfs.runStats.useQuery(
    {
      runId: selectedWorkspace?.runId ?? "",
      dbPath: selectedWorkspace?.dbPath ?? "",
    },
    { enabled: Boolean(selectedWorkspace) }
  );

  const selectedWorkspaceId = selectedWorkspace?.id ?? null;
  const restoreRef = useRef<HTMLInputElement>(null);

  const cloneRun = trpc.agentfs.cloneRun.useMutation({
    onSuccess: (res) => {
      if (!selectedWorkspace) {
        return;
      }
      setSelectedWorkspace({
        ...selectedWorkspace,
        id: res.runId,
        runId: res.runId,
        dbPath: res.dbPath,
        createdAt: new Date().toISOString(),
        pinned: false,
        retentionDays: null,
      });
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const pinRun = trpc.agentfs.pinRun.useMutation({
    onSuccess: () => {
      setSelectedWorkspace((ws) => (ws ? { ...ws, pinned: true } : ws));
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const unpinRun = trpc.agentfs.unpinRun.useMutation({
    onSuccess: () => {
      setSelectedWorkspace((ws) => (ws ? { ...ws, pinned: false } : ws));
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const setRetention = trpc.agentfs.setRetention.useMutation({
    onSuccess: (res) => {
      setSelectedWorkspace((ws) =>
        ws ? { ...ws, retentionDays: res.retentionDays } : ws
      );
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const clearRetention = trpc.agentfs.clearRetention.useMutation({
    onSuccess: () => {
      setSelectedWorkspace((ws) => (ws ? { ...ws, retentionDays: null } : ws));
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const lastInvalidateMs = useRef(0);
  const streamInput = selectedWorkspace
    ? {
        runId: selectedWorkspace.runId,
        dbPath: selectedWorkspace.dbPath,
        dir: "/workspace",
        pollMs: 1000,
      }
    : skipToken;

  trpc.agentfs.stream.useSubscription(streamInput as never, {
    enabled: Boolean(selectedWorkspace),
    onData: (event) => {
      if (!selectedWorkspace) {
        return;
      }
      if (event.type !== "data") {
        return;
      }

      const now = Date.now();
      if (now - lastInvalidateMs.current < 500) {
        return;
      }
      lastInvalidateMs.current = now;

      const { runId } = selectedWorkspace;
      const { dbPath } = selectedWorkspace;

      if (event.toolCalls?.length) {
        void utils.agentfs.operationsList.invalidate({
          runId,
          dbPath,
          limit: 100,
        });
        if (tab === "files") {
          void utils.agentfs.fileAudit.invalidate();
          void utils.agentfs.fileBlame.invalidate();
        }
      }

      if (event.kvStore) {
        void utils.agentfs.kvList.invalidate({ runId, dbPath });
        void utils.agentfs.checkpointsList.invalidate({ runId, dbPath });
      }

      if (event.changes) {
        void utils.agentfs.diff.invalidate({ runId, dbPath });
      }

      if (event.toolCalls?.length || event.kvStore || event.changes) {
        void utils.agentfs.runStats.invalidate({ runId, dbPath });
      }
    },
  });

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

        <div className="flex items-center gap-1">
          <input
            accept=".tar.gz,.tgz"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) {
                return;
              }
              setIsRestoring(true);
              try {
                const resp = await fetch("/api/agentfs/restore", {
                  method: "POST",
                  body: file,
                });
                const json = (await resp.json().catch(() => null)) as null | {
                  runId?: string;
                  dbPath?: string;
                  projectId?: string | null;
                };
                if (!resp.ok || !json?.runId || !json?.dbPath) {
                  return;
                }
                setSelectedWorkspace({
                  id: json.runId,
                  runId: json.runId,
                  dbPath: json.dbPath,
                  projectId:
                    typeof json.projectId === "string" ? json.projectId : null,
                  agentType: "unknown",
                  status: "completed",
                  createdAt: new Date().toISOString(),
                  operationCount: 0,
                  checkpointCount: 0,
                  pinned: false,
                  retentionDays: null,
                });
                void utils.agentfs.workspacesList.invalidate();
              } finally {
                setIsRestoring(false);
              }
            }}
            ref={restoreRef}
            type="file"
          />

          <Button
            className="h-7 w-7"
            disabled={isRestoring}
            onClick={() => restoreRef.current?.click()}
            size="icon"
            title="Restore from archive"
            variant="ghost"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={!selectedWorkspace}
            onClick={() => {
              if (!selectedWorkspace) {
                return;
              }
              const url = new URL(
                "/api/agentfs/export",
                window.location.origin
              );
              url.searchParams.set("runId", selectedWorkspace.runId);
              url.searchParams.set("dbPath", selectedWorkspace.dbPath);
              if (selectedWorkspace.projectId) {
                url.searchParams.set("projectId", selectedWorkspace.projectId);
              }
              window.open(url.toString(), "_blank", "noopener,noreferrer");
            }}
            size="icon"
            title="Export run"
            variant="ghost"
          >
            <Archive className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={!selectedWorkspace || isExportingCas}
            onClick={async () => {
              if (!selectedWorkspace) {
                return;
              }
              setIsExportingCas(true);
              try {
                const url = new URL(
                  "/api/agentfs/export",
                  window.location.origin
                );
                url.searchParams.set("runId", selectedWorkspace.runId);
                url.searchParams.set("dbPath", selectedWorkspace.dbPath);
                url.searchParams.set("store", "1");
                if (selectedWorkspace.projectId) {
                  url.searchParams.set(
                    "projectId",
                    selectedWorkspace.projectId
                  );
                }

                const resp = await fetch(url.toString());
                if (!resp.ok) {
                  return;
                }
                const sha = resp.headers.get("x-agentfs-cas-sha");
                const blob = await resp.blob();
                const href = URL.createObjectURL(blob);
                try {
                  const a = document.createElement("a");
                  a.href = href;
                  const suffix = sha ? sha.slice(0, 12) : "cas";
                  a.download = `agentfs-${selectedWorkspace.runId}-${suffix}.tar.gz`;
                  a.rel = "noopener";
                  document.body.append(a);
                  a.click();
                  a.remove();
                } finally {
                  URL.revokeObjectURL(href);
                }

                if (sha) {
                  try {
                    await navigator.clipboard.writeText(sha);
                  } catch {
                    // ignore
                  }
                  window.prompt("CAS sha (copied if permitted)", sha);
                }
              } finally {
                setIsExportingCas(false);
              }
            }}
            size="icon"
            title="Export run (dedupe)"
            variant="ghost"
          >
            <Layers className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={isRestoringCas}
            onClick={async () => {
              const raw = window.prompt("Restore from CAS sha256");
              if (!raw) {
                return;
              }
              const sha = raw.trim().toLowerCase();
              if (!/^[a-f0-9]{64}$/.test(sha)) {
                return;
              }
              const projectId = selectedWorkspace?.projectId ?? null;
              setIsRestoringCas(true);
              try {
                const resp = await fetch("/api/agentfs/restore", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sha,
                    ...(projectId ? { projectId } : {}),
                  }),
                });
                const json = (await resp.json().catch(() => null)) as null | {
                  runId?: string;
                  dbPath?: string;
                  projectId?: string | null;
                };
                if (!resp.ok || !json?.runId || !json?.dbPath) {
                  return;
                }
                setSelectedWorkspace({
                  id: json.runId,
                  runId: json.runId,
                  dbPath: json.dbPath,
                  projectId:
                    typeof json.projectId === "string" ? json.projectId : null,
                  agentType: "unknown",
                  status: "completed",
                  createdAt: new Date().toISOString(),
                  operationCount: 0,
                  checkpointCount: 0,
                  pinned: false,
                  retentionDays: null,
                });
                void utils.agentfs.workspacesList.invalidate();
              } finally {
                setIsRestoringCas(false);
              }
            }}
            size="icon"
            title="Restore from CAS"
            variant="ghost"
          >
            <Hash className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={!selectedWorkspace}
            onClick={() => {
              if (!selectedWorkspace) {
                return;
              }
              const url = new URL(
                "/api/agentfs/handoff",
                window.location.origin
              );
              url.searchParams.set("runId", selectedWorkspace.runId);
              url.searchParams.set("dbPath", selectedWorkspace.dbPath);
              if (selectedWorkspace.projectId) {
                url.searchParams.set("projectId", selectedWorkspace.projectId);
              }
              window.open(url.toString(), "_blank", "noopener,noreferrer");
            }}
            size="icon"
            title="Download handoff pack"
            variant="ghost"
          >
            <Package className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={
              !selectedWorkspace || pinRun.isPending || unpinRun.isPending
            }
            onClick={() => {
              if (!selectedWorkspace) {
                return;
              }
              if (selectedWorkspace.pinned) {
                unpinRun.mutate({ runId: selectedWorkspace.runId });
              } else {
                pinRun.mutate({ runId: selectedWorkspace.runId });
              }
            }}
            size="icon"
            title={selectedWorkspace?.pinned ? "Unpin run" : "Pin run"}
            variant="ghost"
          >
            {selectedWorkspace?.pinned ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </Button>

          <Button
            className="h-7 w-7"
            disabled={
              !selectedWorkspace ||
              setRetention.isPending ||
              clearRetention.isPending
            }
            onClick={() => {
              if (!selectedWorkspace) {
                return;
              }
              const raw = window.prompt(
                "Retention days (blank = default)",
                selectedWorkspace.retentionDays
                  ? String(selectedWorkspace.retentionDays)
                  : ""
              );
              if (raw === null) {
                return;
              }
              const v = raw.trim();
              if (!v) {
                clearRetention.mutate({ runId: selectedWorkspace.runId });
                return;
              }
              const n = Number.parseInt(v, 10);
              if (!Number.isFinite(n) || n <= 0) {
                return;
              }
              setRetention.mutate({ runId: selectedWorkspace.runId, days: n });
            }}
            size="icon"
            title={
              selectedWorkspace?.retentionDays
                ? `Retention: ${selectedWorkspace.retentionDays}d`
                : "Set retention"
            }
            variant="ghost"
          >
            <Clock className="h-4 w-4" />
          </Button>

          <Button
            className="h-7 w-7"
            disabled={!selectedWorkspace || cloneRun.isPending}
            onClick={() => {
              if (!selectedWorkspace) {
                return;
              }
              cloneRun.mutate({
                source: {
                  runId: selectedWorkspace.runId,
                  dbPath: selectedWorkspace.dbPath,
                },
              });
            }}
            size="icon"
            title="Clone run"
            variant="ghost"
          >
            <Copy className="h-4 w-4" />
          </Button>

          <Button className="h-7 w-7" size="icon" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
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
            <div className="flex items-center justify-between gap-3 border-white/5 border-b px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm">
                  {selectedWorkspace?.runId}
                </div>
                {statsData && (
                  <div className="text-biolum-dim text-xs">
                    {statsData.files} files • {statsData.bytes} bytes •{" "}
                    {statsData.toolCalls} tool calls • {statsData.checkpoints}{" "}
                    checkpoints
                  </div>
                )}
              </div>
            </div>

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
                active={tab === "compare"}
                label="Compare"
                onClick={() => setTab("compare")}
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
              {tab === "compare" && selectedWorkspace && (
                <RunCompare className="h-full" workspace={selectedWorkspace} />
              )}
              {tab === "checkpoints" && selectedWorkspace && (
                <CheckpointBrowser
                  className="h-full"
                  onSelectWorkspace={setSelectedWorkspace}
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
