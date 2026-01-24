"use client";

/**
 * File Audit - File change history
 */

import { Edit, File, Loader2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Workspace } from "./index";

type FileAuditProps = {
  workspace: Workspace;
  className?: string;
};

type FileChange = {
  path: string;
  changeType: "created" | "modified" | "deleted";
  sizeBytes: number;
  mtime: number;
};

function isSensitiveAgentfsPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith("/.env") ||
    lower.includes("/.env.") ||
    lower.includes("/.ssh/") ||
    lower.includes("/.aws/") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  );
}

export function FileAudit({ workspace, className }: FileAuditProps) {
  const {
    data: diffData,
    isLoading: isDiffLoading,
    error: diffError,
  } = trpc.agentfs.diff.useQuery({
    runId: workspace.runId,
    dbPath: workspace.dbPath,
  });

  const changes = diffData?.changes ?? [];

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selected = selectedPath;

  useEffect(() => {
    setSelectedPath(null);
  }, [workspace.dbPath, workspace.runId]);

  const fileChanges = useMemo(() => {
    return changes.map(
      (c): FileChange => ({
        path: c.path,
        changeType: c.type,
        sizeBytes: c.size ?? 0,
        mtime: c.mtime ?? 0,
      })
    );
  }, [changes]);

  const selectedChange = useMemo(() => {
    if (!selected) {
      return null;
    }
    return fileChanges.find((c) => c.path === selected) ?? null;
  }, [fileChanges, selected]);

  const canPreview = Boolean(
    selectedChange && selectedChange.changeType !== "deleted"
  );

  const isSensitive = selected ? isSensitiveAgentfsPath(selected) : false;

  const previewChunkBytes = 200_000;
  const [offsetBytes, setOffsetBytes] = useState(0);
  const [chunks, setChunks] = useState<
    Array<{ offset: number; content: string }>
  >([]);

  useEffect(() => {
    setOffsetBytes(0);
    setChunks([]);
  }, [selected, workspace.dbPath, workspace.runId]);

  const {
    data: sliceData,
    isLoading: isSliceLoading,
    error: sliceError,
  } = trpc.agentfs.fileSlice.useQuery(
    {
      runId: workspace.runId,
      dbPath: workspace.dbPath,
      filePath: selected ?? "",
      offsetBytes,
      maxBytes: previewChunkBytes,
    },
    {
      enabled: Boolean(selected) && canPreview && !isSensitive,
    }
  );

  useEffect(() => {
    if (!sliceData) {
      return;
    }
    setChunks((prev) => {
      const next = prev.filter((c) => c.offset !== sliceData.offsetBytes);
      next.push({ offset: sliceData.offsetBytes, content: sliceData.content });
      next.sort((a, b) => a.offset - b.offset);
      return next;
    });
  }, [sliceData]);

  const { data: auditData, isLoading: isAuditLoading } =
    trpc.agentfs.fileAudit.useQuery(
      {
        runId: workspace.runId,
        dbPath: workspace.dbPath,
        filePath: selected ?? "",
      },
      { enabled: Boolean(selected) }
    );

  const { data: blameData, isLoading: isBlameLoading } =
    trpc.agentfs.fileBlame.useQuery(
      {
        runId: workspace.runId,
        dbPath: workspace.dbPath,
        filePath: selected ?? "",
      },
      { enabled: Boolean(selected) && canPreview }
    );

  const totalBytes = fileChanges.reduce((a, f) => a + (f.sizeBytes ?? 0), 0);

  return (
    <div className={cn("flex h-full", className)}>
      {/* File list */}
      <div className="flex w-96 flex-col border-white/5 border-r">
        <div className="flex items-center justify-between gap-4 border-white/5 border-b px-4 py-3">
          <span className="text-biolum-dim text-sm">
            {fileChanges.length} files ({totalBytes} bytes)
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {isDiffLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
              </div>
            )}
            {diffError && (
              <div className="py-2 text-center text-red-400 text-xs">
                Failed to load file changes
              </div>
            )}
            {!isDiffLoading && fileChanges.length === 0 && !diffError && (
              <div className="py-4 text-center text-biolum-dim text-sm">
                No file changes recorded
              </div>
            )}
            {fileChanges.map((file) => (
              <FileChangeRow
                file={file}
                isSelected={file.path === selected}
                key={file.path}
                onSelect={() => setSelectedPath(file.path)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-white/5 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm">
              {selected ?? "Select a file"}
            </div>
            {selected && canPreview && sliceData && (
              <div className="text-biolum-dim text-xs">
                {sliceData.sizeBytes} bytes
                {sliceData.truncated ? " (truncated)" : ""}
                {sliceData.isBinary ? " (binary)" : ""}
              </div>
            )}
          </div>

          <Button
            disabled={!selected || !canPreview}
            onClick={() => {
              if (!selected) {
                return;
              }

              const confirmSensitive =
                isSensitive &&
                !window.confirm(
                  "This looks like a sensitive file. Download anyway?"
                );
              if (confirmSensitive) {
                return;
              }

              const url = new URL(
                "/api/agentfs/download",
                window.location.origin
              );
              url.searchParams.set("runId", workspace.runId);
              url.searchParams.set("dbPath", workspace.dbPath);
              url.searchParams.set("filePath", selected);
              if (workspace.projectId) {
                url.searchParams.set("projectId", workspace.projectId);
              }
              if (isSensitive) {
                url.searchParams.set("confirm", "1");
              }
              window.open(url.toString(), "_blank", "noopener,noreferrer");
            }}
            size="sm"
            variant="ghost"
          >
            Download
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {!selected && (
              <div className="text-biolum-dim text-sm">
                Select a file to preview
              </div>
            )}
            {selected && !canPreview && (
              <div className="text-biolum-dim text-sm">File was deleted</div>
            )}
            {selected && canPreview && isSensitive && (
              <div className="text-biolum-dim text-sm">
                Preview disabled (sensitive file)
              </div>
            )}
            {selected && canPreview && isSliceLoading && (
              <div className="flex items-center gap-2 text-biolum-dim text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading preview…
              </div>
            )}
            {selected && canPreview && sliceError && (
              <div className="text-red-400 text-xs">{sliceError.message}</div>
            )}
            {selected && canPreview && sliceData && !sliceError && (
              <div className="space-y-6">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  {sliceData.isBinary
                    ? renderHexPreview(sliceData.content)
                    : chunks.map((c) => c.content).join("")}
                </pre>

                {!sliceData.isBinary && sliceData.truncated && (
                  <div>
                    <Button
                      disabled={
                        isSliceLoading ||
                        (sliceData.returnedBytes ?? 0) <= 0 ||
                        !sliceData.truncated
                      }
                      onClick={() =>
                        setOffsetBytes(
                          (prev) =>
                            prev +
                            (sliceData.returnedBytes || previewChunkBytes)
                        )
                      }
                      size="sm"
                      variant="secondary"
                    >
                      Load more
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
                    Blame (best-effort)
                  </div>
                  {isBlameLoading && (
                    <div className="flex items-center gap-2 text-biolum-dim text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading blame…
                    </div>
                  )}
                  {blameData?.candidates?.length ? (
                    <div className="space-y-1">
                      {blameData.candidates.map((c) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1"
                          key={c.id}
                        >
                          <div className="min-w-0 flex-1 truncate font-mono text-xs">
                            {c.name}#{c.id}
                          </div>
                          <div className="text-biolum-dim text-xs">
                            {c.score.toFixed(3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isBlameLoading && (
                      <div className="text-biolum-dim text-sm">
                        No likely tool-call candidates found.
                      </div>
                    )
                  )}
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
                    History (tool calls mentioning this path)
                  </div>
                  {isAuditLoading && (
                    <div className="flex items-center gap-2 text-biolum-dim text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading history…
                    </div>
                  )}
                  {auditData?.changes?.length ? (
                    <div className="space-y-1">
                      {auditData.changes.map((c) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1"
                          key={c.id}
                        >
                          <div className="min-w-0 flex-1 truncate font-mono text-xs">
                            {c.type}#{c.id}
                          </div>
                          <div className="text-biolum-dim text-xs">
                            {new Date(c.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isAuditLoading && (
                      <div className="text-biolum-dim text-sm">
                        No matching tool calls found.
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function renderHexPreview(base64: string): string {
  try {
    const bin = atob(base64);
    const max = Math.min(512, bin.length);
    const bytes = new Uint8Array(max);
    for (let i = 0; i < max; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const slice = bytes.subarray(i, i + 16);
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const ascii = Array.from(slice)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
        .join("");
      lines.push(
        `${i.toString(16).padStart(8, "0")}  ${hex.padEnd(47)}  ${ascii}`
      );
    }
    return lines.join("\n") + (bin.length > max ? "\n…" : "");
  } catch {
    return "(binary)";
  }
}

function FileChangeRow({
  file,
  isSelected,
  onSelect,
}: {
  file: FileChange;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon =
    file.changeType === "created"
      ? Plus
      : file.changeType === "deleted"
        ? Minus
        : Edit;
  const iconColor =
    file.changeType === "created"
      ? "text-green-400"
      : file.changeType === "deleted"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <button
      className={cn(
        "mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5",
        isSelected ? "bg-white/5" : ""
      )}
      onClick={onSelect}
      type="button"
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
      <File className="h-4 w-4 flex-shrink-0 text-biolum-dim" />
      <span className="flex-1 truncate font-mono text-sm">{file.path}</span>
      <span className="text-biolum-dim text-xs">{file.sizeBytes}b</span>
    </button>
  );
}
