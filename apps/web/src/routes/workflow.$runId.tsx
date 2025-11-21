import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkflowDetailContent } from "@/components/workflow-detail-modal";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/workflow/$runId")({
  component: WorkflowRunRoute,
});

function WorkflowRunRoute() {
  const { runId } = Route.useParams();
  const navigate = useNavigate();
  const runQuery = trpc.workflow.get.useQuery({ runId });
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "error">(
    "overview"
  );

  useEffect(() => {
    if (runQuery.data) {
      setActiveTab(runQuery.data.status === "failed" ? "error" : "overview");
    }
  }, [runQuery.data?.status]);

  const eventsQuery = trpc.workflow.events.useQuery(
    { runId },
    { enabled: runQuery.isSuccess }
  );
  const reasoningQuery = trpc.workflow.reasoning.useQuery(
    { runId },
    { enabled: runQuery.isSuccess }
  );

  if (runQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.05_0_0)] text-biolum">
        <p className="text-sm text-biolum-dim">Loading workflow…</p>
      </div>
    );
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[oklch(0.05_0_0)] text-biolum">
        <p className="text-lg font-semibold">Unable to load workflow run.</p>
        <p className="text-biolum-dim text-sm">
          {runQuery.error?.message ?? "Unknown error"}
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/mindscape" })}
        >
          Return to Mindscape
        </Button>
      </div>
    );
  }

  const workflow = runQuery.data;
  const events = eventsQuery.data ?? [];
  const ragDocs =
    reasoningQuery.data?.provenance?.ragDocuments ??
    [];
  const reasoningError = reasoningQuery.isError ? reasoningQuery.error : null;

  return (
    <div className="min-h-screen bg-[oklch(0.05_0_0)] px-4 py-6 text-biolum md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-biolum-dim hover:text-biolum"
            onClick={() => navigate({ to: "/mindscape" })}
          >
            ← Back to Mindscape
          </Button>
          <p className="text-sm text-biolum-faint font-mono">
            Run ID: {workflow.id}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/80 p-6 backdrop-blur">
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
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate({ to: "/mindscape" })}
              >
                Close
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
