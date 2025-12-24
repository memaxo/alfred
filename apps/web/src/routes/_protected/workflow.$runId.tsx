import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { MindscapeWorkflowDrawer } from "@/components/shared/workflow-drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WorkflowDetailContent } from "@/components/workflow-detail-modal";
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
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "error">(
    "overview"
  );
  const [drawerOpen, setDrawerOpen] = useState(search.drawer === "1");

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
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.05_0_0)] text-biolum">
        <p className="text-biolum-dim text-sm">Loading workflow…</p>
      </div>
    );
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[oklch(0.05_0_0)] text-biolum">
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
  const handleNavigateToMindscape = (documentId: string) => {
    navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ragDoc: documentId,
      }),
    });
  };

  return (
    <div className="min-h-screen bg-[oklch(0.05_0_0)] px-4 py-6 text-biolum md:px-8">
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
        onNavigateToMindscape={(documentId) =>
          navigate({
            to: "/",
            search: (prev: Record<string, unknown>) => ({
              ...prev,
              ragDoc: documentId,
            }),
          })
        }
        open={drawerOpen}
        runId={drawerOpen ? workflow.id : null}
      />
    </div>
  );
}
