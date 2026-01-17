import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { MindscapeWorkflowDrawer } from "@/components/shared/workflow-drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WorkflowDetailContent } from "@/components/workflow-detail-modal";
import { useTrajectory, useTrajectoryRefresh } from "@/hooks/trajectory";
import { trpc } from "@/utils/trpc";

const workflowSearchSchema = z.object({
  drawer: z.literal("1").optional(),
});

export const Route = createFileRoute("/_protected/workflow/$runId")({
  component: WorkflowRunRoute,
  validateSearch: workflowSearchSchema,
});

function WorkflowRunRoute() {
  const { runId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const runQuery = trpc.workflow.get.useQuery({ runId });
  const trajectoryQuery = useTrajectory(runId);
  const refreshTrajectory = useTrajectoryRefresh();
  const suspendMutation = trpc.workflow.suspend.useMutation();
  const [isResuming, setIsResuming] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "events" | "error">(
    "overview"
  );
  const [drawerOpen, setDrawerOpen] = useState(search.drawer === "1");

  trpc.workflow.resumePipeline.useSubscription(
    { runId },
    {
      enabled: isResuming,
      onData: (event) => {
        if (event._ === "workflow-complete" || event._ === "error") {
          setIsResuming(false);
          runQuery.refetch();
          eventsQuery.refetch();
        }
      },
      onError: (err) => {
        setIsResuming(false);
        toast.error(`Resume failed: ${err.message}`);
      },
    }
  );

  useEffect(() => {
    if (runQuery.data) {
      setActiveTab(runQuery.data.status === "failed" ? "error" : "overview");
    }
  }, [runQuery.data?.status, runQuery.data]);

  useEffect(() => {
    setDrawerOpen(search.drawer === "1");
  }, [search.drawer]);

  const eventsQuery = trpc.workflow.events.useQuery(
    { runId },
    { enabled: runQuery.isSuccess }
  );
  const reasoningQuery = trpc.workflow.reasoning.useQuery(
    { runId },
    { enabled: runQuery.isSuccess }
  );

  const handleSuspend = async () => {
    try {
      await suspendMutation.mutateAsync({ runId });
      toast.success("Workflow suspension requested.");
      runQuery.refetch();
    } catch (error) {
      toast.error(
        `Failed to suspend: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const handleResume = () => {
    setIsResuming(true);
    toast.info("Resuming workflow from checkpoint...");
  };

  const setDrawer = (open: boolean) => {
    setDrawerOpen(open);
    navigate({
      to: "/workflow/$runId",
      params: { runId },
      search: () => (open ? { drawer: "1" as const } : {}),
      replace: true,
    });
  };

  if (runQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void text-biolum">
        <p className="text-biolum-dim text-sm">Loading workflow…</p>
      </div>
    );
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void text-biolum">
        <p className="font-semibold text-lg">Unable to load workflow run.</p>
        <p className="text-biolum-dim text-sm">
          {runQuery.error?.message ?? "Unknown error"}
        </p>
        <Button onClick={() => navigate({ to: "/" })} variant="secondary">
          Return to Mindscape
        </Button>
      </div>
    );
  }

  const workflow = runQuery.data;
  const events = eventsQuery.data ?? [];
  const ragDocs = reasoningQuery.data?.provenance?.ragDocuments ?? [];
  const reasoningError = reasoningQuery.isError ? reasoningQuery.error : null;
  const handleNavigateToMindscape = (_documentId: string) => {
    navigate({
      to: "/",
    });
  };

  const trajectory = trajectoryQuery.data?.trajectory;
  const canDownload = Boolean(trajectory && typeof trajectory === "object");
  const downloadTrajectory = () => {
    if (!trajectory) {
      return;
    }
    const payload = JSON.stringify(trajectory, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trajectory-${workflow.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = workflow.status === "running";
  const isSuspended = workflow.status === "suspended";

  return (
    <div className="min-h-screen bg-void px-4 py-6 text-biolum md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Dialog
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              navigate({ to: "/" });
            }
          }}
          open
        >
          <DialogContent className="rounded-3xl border border-white/10 bg-void-surface/90 p-0 backdrop-blur">
            <div className="flex items-center justify-between border-white/5 border-b px-6 py-4">
              <Button
                className="text-biolum-dim hover:text-biolum"
                onClick={() => navigate({ to: "/" })}
                variant="ghost"
              >
                ← Back to Mindscape
              </Button>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <Button
                    className="text-amber-400 hover:text-amber-300"
                    disabled={suspendMutation.isPending}
                    onClick={handleSuspend}
                    size="sm"
                    variant="ghost"
                  >
                    Suspend
                  </Button>
                )}
                {isSuspended && (
                  <Button
                    className="text-emerald-400 hover:text-emerald-300"
                    disabled={isResuming}
                    onClick={handleResume}
                    size="sm"
                    variant="ghost"
                  >
                    {isResuming ? "Resuming..." : "Resume"}
                  </Button>
                )}
                <Button
                  className="text-biolum-dim hover:text-biolum"
                  disabled={refreshTrajectory.isPending}
                  onClick={() =>
                    refreshTrajectory.mutate({ runId, format: "atif" })
                  }
                  size="sm"
                  variant="ghost"
                >
                  Refresh Trajectory
                </Button>
                <Button
                  className="text-biolum-dim hover:text-biolum"
                  disabled={!canDownload}
                  onClick={downloadTrajectory}
                  size="sm"
                  variant="ghost"
                >
                  Download ATIF
                </Button>
              </div>
              <Button
                className="text-biolum-dim hover:text-biolum"
                onClick={() => setDrawer(true)}
                size="sm"
                variant="ghost"
              >
                Open Drawer View
              </Button>
              <p className="font-mono text-biolum-faint text-sm">
                Run ID: {workflow.id}
              </p>
            </div>
            <div className="p-6">
              <WorkflowDetailContent
                activeTab={activeTab}
                events={events}
                eventsLoading={eventsQuery.isLoading}
                footer={
                  <Button
                    className="rounded-full"
                    onClick={() => navigate({ to: "/" })}
                    variant="outline"
                  >
                    Close
                  </Button>
                }
                onNavigateToMindscape={handleNavigateToMindscape}
                onTabChange={setActiveTab}
                ragDocs={ragDocs}
                reasoningError={reasoningError}
                reasoningLoading={reasoningQuery.isLoading}
                workflow={workflow}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <MindscapeWorkflowDrawer
        onClose={() => setDrawer(false)}
        onNavigateFull={() => setDrawer(false)}
        onNavigateToMindscape={(_documentId) =>
          navigate({
            to: "/",
          })
        }
        open={drawerOpen}
        runId={drawerOpen ? workflow.id : null}
      />
    </div>
  );
}
