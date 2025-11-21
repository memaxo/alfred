"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WorkflowDetailContent } from "@/components/workflow-detail-modal";
import { trpc } from "@/utils/trpc";

type MindscapeWorkflowDrawerProps = {
  runId: string | null;
  onClose: () => void;
  onNavigateFull?: (runId: string) => void;
  onNavigateToMindscape?: (documentId: string) => void;
};

export function MindscapeWorkflowDrawer({
  runId,
  onClose,
  onNavigateFull,
  onNavigateToMindscape,
}: MindscapeWorkflowDrawerProps) {
  const drawerOpen = Boolean(runId);
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "error">(
    "overview"
  );
  const queryRunId = runId ?? "";

  const runQuery = trpc.workflow.get.useQuery(
    { runId: queryRunId },
    { enabled: drawerOpen && queryRunId.length > 0 }
  );

  const eventsQuery = trpc.workflow.events.useQuery(
    { runId: queryRunId },
    { enabled: drawerOpen && runQuery.isSuccess }
  );
  const reasoningQuery = trpc.workflow.reasoning.useQuery(
    { runId: queryRunId },
    { enabled: drawerOpen && runQuery.isSuccess }
  );

  useEffect(() => {
    setActiveTab("overview");
  }, [runId]);

  useEffect(() => {
    if (!runQuery.data) {
      return;
    }
    setActiveTab(runQuery.data.status === "failed" ? "error" : "overview");
  }, [runQuery.data?.status, runQuery.data]);

  const ragDocs = reasoningQuery.data?.provenance?.ragDocuments ?? [];
  const reasoningError = reasoningQuery.isError ? reasoningQuery.error : null;

  const statusLabel = runQuery.data?.status ?? "loading";
  const headerMono = useMemo(() => {
    if (runQuery.data) {
      return runQuery.data.id;
    }
    return runId ?? "";
  }, [runId, runQuery.data]);

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      open={drawerOpen}
    >
      <DialogContent
        className="h-screen max-w-full translate-y-0 rounded-none border-white/10 border-l bg-void-surface/95 p-0 text-biolum shadow-2xl sm:max-w-lg"
        showCloseButton
        variant="drawer"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-white/10 border-b px-5 py-4">
            <div>
              <p className="text-[11px] text-biolum-faint uppercase tracking-wide">
                Workflow run
              </p>
              <p className="font-mono text-biolum text-xs">{headerMono}</p>
              <p className="text-biolum-dim text-xs capitalize">
                {statusLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="text-biolum-dim hover:text-biolum"
                data-testid="mindscape-drawer-open-full"
                onClick={() => {
                  if (!runId) {
                    return;
                  }
                  onClose();
                  onNavigateFull?.(runId);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Open full view
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {runQuery.isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-biolum-dim">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm">Loading workflow…</p>
              </div>
            ) : runQuery.isError || !runQuery.data ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-biolum">
                <p className="font-semibold">Unable to load workflow run.</p>
                <p className="text-biolum-dim text-sm">
                  {runQuery.error?.message ?? "Unknown error"}
                </p>
                <Button
                  onClick={() => void runQuery.refetch()}
                  size="sm"
                  variant="secondary"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <WorkflowDetailContent
                activeTab={activeTab}
                events={eventsQuery.data ?? []}
                eventsLoading={eventsQuery.isLoading}
                footer={
                  <div className="flex w-full justify-end gap-2">
                    <Button
                      className="rounded-full"
                      onClick={() => {
                        if (!runId) {
                          return;
                        }
                        onClose();
                        onNavigateFull?.(runId);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Open full view
                    </Button>
                    <Button
                      className="rounded-full"
                      onClick={onClose}
                      size="sm"
                      variant="secondary"
                    >
                      Close
                    </Button>
                  </div>
                }
                onMindscapeNavigate={onClose}
                onNavigateToMindscape={(docId) => {
                  onNavigateToMindscape?.(docId);
                }}
                onTabChange={setActiveTab}
                ragDocs={ragDocs}
                reasoningError={reasoningError}
                reasoningLoading={reasoningQuery.isLoading}
                workflow={runQuery.data}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
