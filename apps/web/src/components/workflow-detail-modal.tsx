import type { inferRouterOutputs } from "@trpc/server";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
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
type WorkflowReasoningResult = inferRouterOutputs<TRPCAppRouter>["workflow"]["reasoning"];
type WorkflowEvents = inferRouterOutputs<TRPCAppRouter>["workflow"]["events"];

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
  const reasoningQuery = trpc.workflow.reasoning.useQuery(
    { runId: workflow?.id ?? "" },
    { enabled: open && !!workflow?.id }
  );

  const events = eventsQuery.data ?? [];
  const ragDocs: WorkflowReasoningResult["provenance"]["ragDocuments"] =
    reasoningQuery.data?.provenance?.ragDocuments ?? [];
  const reasoningError = reasoningQuery.isError ? reasoningQuery.error : null;

  if (!workflow) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl shadow-none">
        <WorkflowDetailContent
          workflow={workflow}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          events={events}
          eventsLoading={eventsQuery.isLoading}
          ragDocs={ragDocs}
          reasoningLoading={reasoningQuery.isLoading}
          reasoningError={reasoningError}
          footer={
            <Button onClick={onClose} variant="outline" className="rounded-full">
              Close
            </Button>
          }
          onMindscapeNavigate={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

type WorkflowDetailContentProps = {
  workflow: WorkflowRun;
  activeTab: "overview" | "events" | "error";
  onTabChange: (tab: "overview" | "events" | "error") => void;
  events: WorkflowEvents;
  eventsLoading: boolean;
  ragDocs: WorkflowReasoningResult["provenance"]["ragDocuments"];
  reasoningLoading: boolean;
  reasoningError: Error | null;
  footer?: React.ReactNode;
  onMindscapeNavigate?: () => void;
};

export function WorkflowDetailContent({
  workflow,
  activeTab,
  onTabChange,
  events,
  eventsLoading,
  ragDocs,
  reasoningLoading,
  reasoningError,
  footer,
  onMindscapeNavigate,
}: WorkflowDetailContentProps) {
  const navigate = useNavigate();
  const showErrorTab = workflow.status === "failed";

  return (
    <>
      <DialogHeader className="px-0">
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

      <div className="flex gap-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => onTabChange("overview")}
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
          onClick={() => onTabChange("events")}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "events"
              ? "border-b-2 border-biolum text-biolum"
              : "text-biolum-dim hover:text-biolum"
          }`}
        >
          Events ({events.length})
        </button>
        {showErrorTab && (
          <button
            type="button"
            onClick={() => onTabChange("error")}
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

            <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-biolum text-sm font-medium">
                    RAG Provenance
                  </h4>
                  <p className="text-biolum-dim text-xs">
                    Documents referenced by the reasoning chain
                  </p>
                </div>
                <BiolumBadge variant="default">{ragDocs.length}</BiolumBadge>
              </div>
              <div className="mt-3">
                {reasoningLoading ? (
                  <p className="text-biolum-dim text-sm">Loading provenance…</p>
                ) : reasoningError ? (
                  <p className="text-red-400 text-sm">
                    Unable to load provenance. Please retry in a moment.
                  </p>
                ) : ragDocs.length === 0 ? (
                  <p className="text-biolum-dim text-sm">
                    No RAG documents linked for this run.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {ragDocs.map((doc) => (
                      <li
                        key={doc.documentId}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <p className="text-biolum text-sm font-medium">
                          {doc.label || "Document"}
                        </p>
                        <p className="text-biolum-faint font-mono text-xs">
                          {doc.documentId.slice(0, 8)}…
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-2 text-xs text-biolum"
                          onClick={() => {
                            navigate({
                              to: "/mindscape",
                              search: (prev) => ({
                                ...prev,
                                ragDoc: doc.documentId,
                              }),
                            });
                            onMindscapeNavigate?.();
                          }}
                        >
                          View in Mindscape
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="p-4">
            {eventsLoading ? (
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

        {activeTab === "error" && showErrorTab && (
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

      {footer && (
        <div className="flex gap-2 justify-end border-t border-white/10 pt-4">
          {footer}
        </div>
      )}
    </>
  );
}
