import { Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CognitiveFeedbackControls } from "@/components/cognitive-feedback/controls";
import {
  CognitiveFeedbackDialog,
  type CognitiveFeedbackDraft,
} from "@/components/cognitive-feedback/dialog";
import { useFocusTrap } from "@/components/desktop/accessibility/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WorkflowDetailContent } from "@/components/workflow-detail-modal";
import { useCognitiveFeedback } from "@/hooks/use-cognitive-feedback";
import { formatRelativeTime } from "@/lib/time";
import { trpc } from "@/utils/trpc";

interface MindscapeWorkflowDrawerProps {
  runId: string | null;
  open?: boolean;
  onClose: () => void;
  onNavigateFull?: (runId: string) => void;
  onNavigateToMindscape?: (documentId: string) => void;
}

interface DrawerErrorBoundaryProps {
  children: React.ReactNode;
  fallback: (props: {
    error: Error | null;
    reset: () => void;
  }) => React.ReactNode;
  resetKeys?: unknown[];
}

interface DrawerErrorBoundaryState {
  error: Error | null;
}

// oxlint-disable useReactFunctionComponents: Error boundaries must be class components per React API
class DrawerErrorBoundary extends React.Component<
  DrawerErrorBoundaryProps,
  DrawerErrorBoundaryState
> {
  override state: DrawerErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DrawerErrorBoundaryState {
    return { error };
  }

  override componentDidUpdate(prevProps: DrawerErrorBoundaryProps) {
    const prevKey = prevProps.resetKeys?.map(String).join("|") ?? "__no_key__";
    const nextKey = this.props.resetKeys?.map(String).join("|") ?? "__no_key__";
    if (prevKey !== nextKey && this.state.error) {
      // Reset error state when reset keys change.
      this.setState({ error: null });
    }
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
      });
    }
    return this.props.children;
  }
}

export function MindscapeWorkflowDrawer({
  runId,
  open,
  onClose,
  onNavigateFull,
  onNavigateToMindscape,
}: MindscapeWorkflowDrawerProps) {
  const drawerOpen = open ?? Boolean(runId);
  const [activeTab, setActiveTab] = useState<
    "overview" | "work" | "events" | "error"
  >("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [runId]);

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
        data-testid="mindscape-workflow-drawer"
        showCloseButton
        variant="drawer"
      >
        <DrawerErrorBoundary
          fallback={({ error, reset }) => (
            <DrawerErrorState error={error} onClose={onClose} onRetry={reset} />
          )}
          resetKeys={[runId, drawerOpen]}
        >
          <WorkflowDrawerBody
            activeTab={activeTab}
            drawerOpen={drawerOpen}
            onClose={onClose}
            onNavigateFull={onNavigateFull}
            onNavigateToMindscape={onNavigateToMindscape}
            onTabChange={setActiveTab}
            runId={runId}
          />
        </DrawerErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

type WorkflowDrawerBodyProps = MindscapeWorkflowDrawerProps & {
  drawerOpen: boolean;
  activeTab: "overview" | "work" | "events" | "error";
  onTabChange: (tab: "overview" | "work" | "events" | "error") => void;
};

function WorkflowDrawerBody({
  runId,
  drawerOpen,
  activeTab,
  onTabChange,
  onClose,
  onNavigateFull,
  onNavigateToMindscape,
}: WorkflowDrawerBodyProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, drawerOpen);

  const queryRunId = drawerOpen && runId ? runId : "";
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
    if (!runQuery.data) {
      return;
    }
    onTabChange(runQuery.data.status === "failed" ? "error" : "overview");
  }, [runQuery.data?.status, onTabChange]);

  const ragDocs = reasoningQuery.data?.provenance?.ragDocuments ?? [];
  const reasoningError = reasoningQuery.isError ? reasoningQuery.error : null;
  const statusLabel = runQuery.data?.status ?? "loading";
  const headerMono = useMemo(() => {
    if (runQuery.data) {
      return runQuery.data.id;
    }
    return runId ?? "";
  }, [runId, runQuery.data]);

  const [submittedFeedback, setSubmittedFeedback] = useState<{
    intent: "positive" | "negative";
    updatedAt: number;
  } | null>(null);
  const [feedbackDraft, setFeedbackDraft] =
    useState<CognitiveFeedbackDraft | null>(null);
  const {
    submit: submitFeedback,
    status: feedbackStatus,
    error: feedbackError,
    reset: resetFeedback,
  } = useCognitiveFeedback();

  const handleFeedbackIntent = (intent: "positive" | "negative") => {
    if (!runId) {
      return;
    }
    const inputData = runQuery.data?.inputData as
      | { requirement?: string }
      | undefined;
    const expected =
      typeof inputData?.requirement === "string"
        ? inputData.requirement
        : `Workflow ${runId}`;
    setFeedbackDraft({
      streamId: runId,
      expected,
      actual: "",
      intent,
      surface: "mindscape",
    });
  };

  const handleFeedbackClose = (open: boolean) => {
    if (!open) {
      setFeedbackDraft(null);
      resetFeedback();
    }
  };

  const handleFeedbackSubmit = async (values: {
    expected: string;
    actual: string;
    surface?: string;
  }) => {
    if (!(feedbackDraft && runId)) {
      return;
    }
    try {
      await submitFeedback({
        streamId: runId,
        expected: values.expected,
        actual: values.actual,
        surface: (values.surface ?? feedbackDraft.surface ?? "mindscape") as
          | "chat"
          | "mindscape"
          | "voice",
      });
      setSubmittedFeedback({
        intent: feedbackDraft.intent,
        updatedAt: Date.now(),
      });
      toast.success("Workflow feedback recorded.");
      setFeedbackDraft(null);
      resetFeedback();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit feedback.";
      toast.error(message);
    }
  };

  return (
    <div ref={drawerRef} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-white/10 border-b px-5 py-4">
        <div>
          <p className="text-[11px] text-biolum-faint uppercase tracking-wide">
            Workflow run
          </p>
          <p className="font-mono text-biolum text-xs">{headerMono}</p>
          <p className="text-biolum-dim text-xs capitalize">{statusLabel}</p>
          {submittedFeedback ? (
            <p className="text-[10px] text-biolum-faint uppercase tracking-wide">
              {submittedFeedback.intent === "positive"
                ? "Marked accurate"
                : "Needs revision"}
              {" · "}
              {formatRelativeTime(new Date(submittedFeedback.updatedAt))}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {runId ? (
            <CognitiveFeedbackControls
              disabled={feedbackStatus === "pending"}
              onNegative={() => handleFeedbackIntent("negative")}
              onPositive={() => handleFeedbackIntent("positive")}
              testIdPrefix="mindscape-drawer-feedback"
            />
          ) : null}
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
            onTabChange={onTabChange}
            ragDocs={ragDocs}
            reasoningError={reasoningError}
            reasoningLoading={reasoningQuery.isLoading}
            workflow={runQuery.data}
          />
        )}
      </div>
      <CognitiveFeedbackDialog
        draft={feedbackDraft}
        error={feedbackError}
        onOpenChange={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
        status={feedbackStatus}
      />
    </div>
  );
}

function DrawerErrorState({
  error,
  onClose,
  onRetry,
}: {
  error: Error | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-biolum">
      <div>
        <p className="font-semibold text-lg">Workflow drawer unavailable</p>
        <p className="mt-2 text-biolum-dim text-sm">
          {error?.message ??
            "This drawer relies on the workflow service, which is offline right now."}
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={() => {
            onRetry();
          }}
          variant="outline"
        >
          Retry
        </Button>
        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      </div>
    </div>
  );
}
