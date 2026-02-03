/**
 * Workflow Compilation View
 *
 * Displays the final compilation of a workflow run including:
 * - Summary text
 * - File changes (created/modified/deleted)
 * - Agent outcomes
 * - Stage durations
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 4
 */

import {
  CheckCircle2,
  Clock,
  FileCode2,
  FilePlus,
  FileX,
  Users,
  XCircle,
} from "lucide-react";

import { trpc } from "@/utils/trpc";

import { ScrollArea } from "../../ui/scroll-area";
import { TinyDot } from "../shared";

interface CompilationViewProps {
  runId: string;
}

export function CompilationView({ runId }: CompilationViewProps) {
  const compilationQuery = trpc.workflow.compilation.get.useQuery({ runId });

  if (compilationQuery.isLoading) {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading compilation...
          </div>
        </div>
      </div>
    );
  }

  if (compilationQuery.isError || !compilationQuery.data) {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <XCircle className="h-8 w-8" />
          <p>No compilation available</p>
          <p className="text-xs">The workflow may still be running</p>
        </div>
      </div>
    );
  }

  const compilation = compilationQuery.data;

  return (
    <div className="h-full rounded-xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-3">
          <div className="flex items-center gap-2">
            <TinyDot
              color={compilation.status === "completed" ? "green" : "red"}
            />
            <span className="font-medium">Compilation</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {compilation.totalDurationMs
              ? `${(compilation.totalDurationMs / 1000).toFixed(1)}s`
              : "—"}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">
            {/* Summary */}
            {compilation.summaryText && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                  Summary
                </h4>
                <p className="text-sm leading-relaxed">
                  {compilation.summaryText}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                icon={<Users className="h-3 w-3" />}
                label="Agents"
                value={compilation.agentsSpawned ?? compilation.agents.length}
              />
              <StatCard
                icon={<FileCode2 className="h-3 w-3" />}
                label="Files Changed"
                value={compilation.filesChanged ?? 0}
              />
              <StatCard
                icon={<CheckCircle2 className="h-3 w-3" />}
                label="Stages"
                value={compilation.stages.length}
              />
            </div>

            {/* File Changes */}
            {compilation.fileChanges &&
              (compilation.fileChanges.created.length > 0 ||
                compilation.fileChanges.modified.length > 0 ||
                compilation.fileChanges.deleted.length > 0) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">
                    File Changes
                  </h4>

                  {compilation.fileChanges.created.length > 0 && (
                    <FileChangeList
                      icon={<FilePlus className="h-3 w-3 text-green-400" />}
                      label="Created"
                      files={compilation.fileChanges.created}
                    />
                  )}

                  {compilation.fileChanges.modified.length > 0 && (
                    <FileChangeList
                      icon={<FileCode2 className="h-3 w-3 text-yellow-400" />}
                      label="Modified"
                      files={compilation.fileChanges.modified}
                    />
                  )}

                  {compilation.fileChanges.deleted.length > 0 && (
                    <FileChangeList
                      icon={<FileX className="h-3 w-3 text-red-400" />}
                      label="Deleted"
                      files={compilation.fileChanges.deleted}
                    />
                  )}
                </div>
              )}

            {/* Agent Outcomes */}
            {compilation.agents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                  Agent Outcomes
                </h4>
                <div className="space-y-1">
                  {compilation.agents.map((agent) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <TinyDot
                          color={
                            agent.status === "success"
                              ? "green"
                              : agent.status === "failed"
                                ? "red"
                                : "yellow"
                          }
                        />
                        <span className="font-mono text-xs">
                          {agent.agentId}
                        </span>
                        {agent.role && (
                          <span className="text-xs text-muted-foreground">
                            ({agent.role})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {agent.durationSeconds && (
                          <span>{agent.durationSeconds.toFixed(1)}s</span>
                        )}
                        {agent.escalation && (
                          <span className="text-yellow-400">⚠</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stages */}
            {compilation.stages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                  Stages
                </h4>
                <div className="space-y-1">
                  {compilation.stages.map((stage) => (
                    <div
                      key={stage.name}
                      className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <TinyDot
                          color={
                            stage.status === "success"
                              ? "green"
                              : stage.status === "failed"
                                ? "red"
                                : "gray"
                          }
                        />
                        <span className="capitalize">
                          {stage.name.replaceAll("-", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(stage.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Info */}
            {compilation.error && (
              <div className="space-y-1 rounded bg-red-500/10 p-2">
                <h4 className="text-xs font-medium text-red-400 uppercase">
                  Error
                </h4>
                <p className="text-sm text-red-300">{compilation.error}</p>
                {compilation.lastStage && (
                  <p className="text-xs text-muted-foreground">
                    Failed at: {compilation.lastStage}
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded bg-white/5 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}

function FileChangeList({
  icon,
  label,
  files,
}: {
  icon: React.ReactNode;
  label: string;
  files: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
          {files.length}
        </span>
      </div>
      <div className="space-y-0.5 pl-5">
        {files.slice(0, 10).map((file) => (
          <div
            key={file}
            className="truncate font-mono text-xs text-muted-foreground"
          >
            {file}
          </div>
        ))}
        {files.length > 10 && (
          <div className="text-xs text-muted-foreground">
            +{files.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
}
