import { useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkflowErrorPanel } from "@/components/workflow-error-panel";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

type WorkflowRun =
  inferRouterOutputs<TRPCAppRouter>["workflow"]["listRuns"][number];
type WorkflowReasoningResult =
  inferRouterOutputs<TRPCAppRouter>["workflow"]["reasoning"];
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "overview" | "work" | "events" | "error"
  >(
    workflow?.status === "completed"
      ? "work"
      : workflow?.status === "failed"
        ? "error"
        : "overview"
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
  const handleNavigateToMindscape = (documentId: string) => {
    navigate({
      to: "/",
      search: (prev: Record<string, unknown> | undefined) => ({
        ...(prev ?? {}),
        resourceType: "knowledge",
        resourceId: documentId,
      }),
    });
    onClose();
  };

  if (!workflow) {
    return null;
  }

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-4xl rounded-3xl border border-white/10 bg-void-surface/90 shadow-none backdrop-blur-xl">
        <WorkflowDetailContent
          activeTab={activeTab}
          events={events}
          eventsLoading={eventsQuery.isLoading}
          footer={
            <Button
              className="rounded-full"
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          }
          onMindscapeNavigate={onClose}
          onNavigateToMindscape={handleNavigateToMindscape}
          onTabChange={setActiveTab}
          ragDocs={ragDocs}
          reasoningError={reasoningError}
          reasoningLoading={reasoningQuery.isLoading}
          workflow={workflow}
        />
      </DialogContent>
    </Dialog>
  );
}

type WorkflowDetailContentProps = {
  workflow: WorkflowRun;
  activeTab: "overview" | "work" | "events" | "error";
  onTabChange: (tab: "overview" | "work" | "events" | "error") => void;
  events: WorkflowEvents;
  eventsLoading: boolean;
  ragDocs: WorkflowReasoningResult["provenance"]["ragDocuments"];
  reasoningLoading: boolean;
  reasoningError: { message: string } | null;
  footer?: React.ReactNode;
  onMindscapeNavigate?: () => void;
  onNavigateToMindscape?: (documentId: string) => void;
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
  onNavigateToMindscape,
}: WorkflowDetailContentProps) {
  const showErrorTab = workflow.status === "failed";
  const compilationQuery = trpc.workflow.compilation.get.useQuery(
    { runId: workflow.id },
    { enabled: activeTab === "work" }
  );

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

      <div className="flex gap-2 border-white/10 border-b">
        <button
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "overview"
              ? "border-biolum border-b-2 text-biolum"
              : "text-biolum-dim hover:text-biolum"
          }`}
          onClick={() => onTabChange("overview")}
          type="button"
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "work"
              ? "border-biolum border-b-2 text-biolum"
              : "text-biolum-dim hover:text-biolum"
          }`}
          onClick={() => onTabChange("work")}
          type="button"
        >
          Work
        </button>
        <button
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "events"
              ? "border-biolum border-b-2 text-biolum"
              : "text-biolum-dim hover:text-biolum"
          }`}
          onClick={() => onTabChange("events")}
          type="button"
        >
          Events ({events.length})
        </button>
        {showErrorTab && (
          <button
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === "error"
                ? "border-red-400 border-b-2 text-red-400"
                : "text-biolum-dim hover:text-red-400"
            }`}
            onClick={() => onTabChange("error")}
            type="button"
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
                  {workflow.created
                    ? new Date(workflow.created).toLocaleString()
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
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
                    {workflow.errorMessage}
                  </p>
                </div>
              )}
              {workflow.linearSessionId && (
                <div className="md:col-span-2">
                  <h4 className="text-biolum-dim text-sm">Linear Session</h4>
                  <p className="font-mono text-biolum text-sm">
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

            {workflow.inputData !== null &&
              workflow.inputData !== undefined && (
                <div>
                  <h4 className="mb-2 text-biolum-dim text-sm">Input Data</h4>
                  <pre className="overflow-x-auto rounded-xl border border-white/10 bg-void-surface/40 p-4 font-mono text-biolum text-xs">
                    {JSON.stringify(workflow.inputData, null, 2)}
                  </pre>
                </div>
              )}

            <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-biolum text-sm">
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
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                        key={doc.documentId}
                      >
                        <p className="font-medium text-biolum text-sm">
                          {doc.label || "Document"}
                        </p>
                        <p className="font-mono text-biolum-faint text-xs">
                          {doc.documentId.slice(0, 8)}…
                        </p>
                        <Button
                          className="mt-2 h-7 px-2 text-biolum text-xs"
                          onClick={() => {
                            onNavigateToMindscape?.(doc.documentId);
                            onMindscapeNavigate?.();
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
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

        {activeTab === "work" && (
          <div className="space-y-4 p-4">
            {compilationQuery.isLoading ? (
              <p className="py-8 text-center text-biolum-dim">
                Loading compilation...
              </p>
            ) : compilationQuery.isError ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
                {compilationQuery.error.message}
              </p>
            ) : compilationQuery.data ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-biolum text-sm">
                        Completion Summary
                      </h4>
                      <p className="mt-2 text-biolum-dim text-sm">
                        {compilationQuery.data.summaryText ?? "—"}
                      </p>
                    </div>
                    <BiolumBadge
                      variant={
                        compilationQuery.data.status === "completed"
                          ? "success"
                          : "error"
                      }
                    >
                      {compilationQuery.data.status}
                    </BiolumBadge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
                    <h4 className="mb-2 text-biolum-dim text-sm">Files</h4>
                    <p className="text-biolum text-sm">
                      Created:{" "}
                      {compilationQuery.data.fileChanges.created.length}
                    </p>
                    <p className="text-biolum text-sm">
                      Modified:{" "}
                      {compilationQuery.data.fileChanges.modified.length}
                    </p>
                    <p className="text-biolum text-sm">
                      Deleted:{" "}
                      {compilationQuery.data.fileChanges.deleted.length}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
                    <h4 className="mb-2 text-biolum-dim text-sm">Timing</h4>
                    <p className="text-biolum text-sm">
                      Total duration:{" "}
                      {typeof compilationQuery.data.totalDurationMs === "number"
                        ? `${compilationQuery.data.totalDurationMs}ms`
                        : "—"}
                    </p>
                    <p className="text-biolum text-sm">
                      Agents spawned:{" "}
                      {typeof compilationQuery.data.agentsSpawned === "number"
                        ? compilationQuery.data.agentsSpawned
                        : "—"}
                    </p>
                    <p className="text-biolum text-sm">
                      Learning insights:{" "}
                      {typeof compilationQuery.data.learningInsights ===
                      "number"
                        ? compilationQuery.data.learningInsights
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-4 backdrop-blur">
                  <h4 className="mb-2 text-biolum-dim text-sm">Agents</h4>
                  {compilationQuery.data.agents.length === 0 ? (
                    <p className="text-biolum-dim text-sm">
                      No agent outcomes recorded.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {compilationQuery.data.agents.map((agent) => (
                        <li
                          className="rounded-2xl border border-white/10 bg-white/5 p-3"
                          key={agent.agentId}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-biolum text-xs">
                                {agent.agentId}
                              </p>
                              <p className="mt-1 text-biolum-dim text-sm">
                                {agent.result?.summary ??
                                  agent.escalation ??
                                  "—"}
                              </p>
                            </div>
                            <BiolumBadge
                              variant={
                                agent.status === "completed"
                                  ? "success"
                                  : agent.status === "failed" ||
                                      agent.status === "stuck"
                                    ? "error"
                                    : "default"
                              }
                            >
                              {agent.status}
                            </BiolumBadge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-biolum-dim text-sm">
                No work compilation is available for this run yet.
              </p>
            )}
          </div>
        )}

        {activeTab === "events" && (
          <div className="p-4">
            {eventsLoading ? (
              <p className="py-8 text-center text-biolum-dim">
                Loading events...
              </p>
            ) : events.length === 0 ? (
              <p className="py-8 text-center text-biolum-dim">
                No events recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    className="rounded-xl border border-white/10 bg-void-surface/20 p-4"
                    key={event.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-biolum text-sm">
                            {event.eventType}
                          </span>
                          <span className="text-biolum-faint text-xs">
                            {new Date(
                              event.timestamp ?? ""
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                        {(() => {
                          const escalation = parseEscalation(event.eventData);
                          if (escalation) {
                            return (
                              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-amber-100 text-sm">
                                    Escalation ({escalation.severity})
                                  </div>
                                  <div className="text-amber-200 text-xs">
                                    {escalation.agentId}
                                  </div>
                                </div>
                                <div className="mt-1 text-amber-100 text-xs">
                                  <span className="font-medium">Reason:</span>{" "}
                                  {escalation.reason}
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-amber-100 text-xs">
                                  {escalation.details}
                                </div>
                                {escalation.suggestions &&
                                  escalation.suggestions.length > 0 && (
                                    <div className="mt-2 text-amber-100 text-xs">
                                      <div className="font-medium">
                                        Suggestions
                                      </div>
                                      <ul className="mt-1 list-inside list-disc">
                                        {escalation.suggestions.map((s) => (
                                          <li key={s}>{s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            );
                          }

                          if (
                            event.eventData !== null &&
                            event.eventData !== undefined
                          ) {
                            return (
                              <pre className="mt-2 overflow-x-auto font-mono text-biolum-dim text-xs">
                                {JSON.stringify(event.eventData, null, 2)}
                              </pre>
                            );
                          }

                          return null;
                        })()}
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
                timestamp: normalizeTimestamp(workflow.completedAt),
              }}
              runId={workflow.id}
            />
          </div>
        )}
      </div>

      {footer && (
        <div className="flex justify-end gap-2 border-white/10 border-t pt-4">
          {footer}
        </div>
      )}
    </>
  );
}

function normalizeTimestamp(
  value: WorkflowRun["completedAt"]
): string | undefined {
  if (!value) {
    return;
  }
  return value;
}

type EscalationEventData = {
  agentId: string;
  reason: string;
  details: string;
  suggestions?: string[];
  severity: "warning" | "blocking";
};

function parseEscalation(eventData: unknown): EscalationEventData | null {
  if (!eventData || typeof eventData !== "object") {
    return null;
  }
  const env = eventData as { data?: unknown };
  if (!env.data || typeof env.data !== "object") {
    return null;
  }
  const data = env.data as Record<string, unknown>;
  if (data.kind !== "escalation") {
    return null;
  }

  const agentId = typeof data.agentId === "string" ? data.agentId : "";
  const reason = typeof data.reason === "string" ? data.reason : "";
  const details = typeof data.details === "string" ? data.details : "";
  const severity =
    data.severity === "warning" || data.severity === "blocking"
      ? data.severity
      : null;

  if (!(agentId && reason && details && severity)) {
    return null;
  }

  const suggestionsRaw = data.suggestions;
  const suggestions =
    Array.isArray(suggestionsRaw) &&
    suggestionsRaw.every((s) => typeof s === "string")
      ? (suggestionsRaw as string[])
      : undefined;

  return { agentId, reason, details, suggestions, severity };
}
