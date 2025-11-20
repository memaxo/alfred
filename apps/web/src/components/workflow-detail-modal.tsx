import type { inferRouterOutputs } from "@trpc/server";
import { Eye, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BiolumBadge } from "@/components/tremor";
import { WorkflowErrorPanel, type WorkflowError } from "@/components/workflow-error-panel";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

type WorkflowRun = inferRouterOutputs<TRPCAppRouter>["workflow"]["listRuns"][number];

export type WorkflowDetailModalProps = {
  workflow: WorkflowRun | null;
  open: boolean;
  onClose: () => void;
};

export function WorkflowDetailModal({
  workflow,
  open,
  onClose,
}: WorkflowDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "error">(
    workflow?.status === "failed" ? "error" : "overview"
  );

  const eventsQuery = trpc.workflow.events.useQuery(
    { runId: workflow?.id ?? "" },
    { enabled: open && !!workflow?.id }
  );

  const events = eventsQuery.data ?? [];

  if (!workflow) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl shadow-none">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-biolum tracking-tighter">
                Workflow Details
              </DialogTitle>
              <DialogDescription className="text-biolum-dim">
                {workflow.workflowId} • {workflow.id.slice(0, 8)}
              </DialogDescription>
            </div>
            <BiolumBadge
              variant={
                workflow.status === "completed"
                  ? "success"
                  : workflow.status === "failed"
                    ? "error"
                    : workflow.status === "suspended"
                      ? "warning"
                      : "default"
              }
            >
              {workflow.status}
            </BiolumBadge>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === "overview"
                ? "border-b-2 border-biolum text-biolum"
                : "text-biolum-dim hover:text-biolum"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === "events"
                ? "border-b-2 border-biolum text-biolum"
                : "text-biolum-dim hover:text-biolum"
            }`}
          >
            Events ({events.length})
          </button>
          {workflow.status === "failed" && (
            <button
              type="button"
              onClick={() => setActiveTab("error")}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === "error"
                  ? "border-b-2 border-red-400 text-red-400"
                  : "text-biolum-dim hover:text-red-400"
              }`}
            >
              Error Details
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {activeTab === "overview" && (
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-biolum-dim text-sm">Started</h4>
                  <p className="text-biolum">
                    {workflow.startedAt
                      ? new Date(workflow.startedAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <h4 className="text-biolum-dim text-sm">Completed</h4>
                  <p className="text-biolum">
                    {workflow.completedAt
                      ? new Date(workflow.completedAt).toLocaleString()
                      : workflow.status === "running"
                        ? "In progress..."
                        : "—"}
                  </p>
                </div>
                {workflow.errorMessage && (
                  <div className="md:col-span-2">
                    <h4 className="text-red-400 text-sm">Error</h4>
                    <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/30">
                      {workflow.errorMessage}
                    </p>
                  </div>
                )}
                {workflow.linearSessionId && (
                  <div className="md:col-span-2">
                    <h4 className="text-biolum-dim text-sm">Linear Session</h4>
                    <p className="text-biolum text-sm font-mono">
                      {workflow.linearSessionId}
                    </p>
                    {workflow.linearSpace && (
                      <p className="text-biolum-dim text-xs">
                        Space: {workflow.linearSpace}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {workflow.inputData && (
                <div>
                  <h4 className="text-biolum-dim text-sm mb-2">Input Data</h4>
                  <pre className="text-biolum text-xs bg-void-surface/40 p-4 rounded-xl overflow-x-auto font-mono border border-white/10">
                    {JSON.stringify(workflow.inputData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === "events" && (
            <div className="p-4">
              {eventsQuery.isLoading ? (
                <p className="text-biolum-dim text-center py-8">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-biolum-dim text-center py-8">No events recorded.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-white/10 bg-void-surface/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-biolum text-sm font-medium">
                              {event.eventType}
                            </span>
                            <span className="text-biolum-faint text-xs">
                              {new Date(event.timestamp ?? "").toLocaleTimeString()}
                            </span>
                          </div>
                          {event.eventData && (
                            <pre className="text-biolum-dim text-xs mt-2 overflow-x-auto font-mono">
                              {JSON.stringify(event.eventData, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "error" && workflow.status === "failed" && (
            <div className="p-4">
              <WorkflowErrorPanel
                error={{
                  message: workflow.errorMessage ?? "Unknown error",
                  timestamp: workflow.completedAt?.toISOString(),
                }}
                runId={workflow.id}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end border-t border-white/10 pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

