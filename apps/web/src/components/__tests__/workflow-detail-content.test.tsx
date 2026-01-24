import { fireEvent, render } from "@testing-library/react";

import "../../test/testing-library";
import "../../test/reset-mocks";
import { describe, expect, it, mock } from "bun:test";

mock.module("@/components/ui/dialog", () => {
  const React = require("react");
  const Passthrough = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    Dialog: Passthrough,
    DialogContent: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: Passthrough,
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
    DialogOverlay: Passthrough,
    DialogPortal: Passthrough,
    DialogTrigger: Passthrough,
  };
});

import type { inferRouterOutputs } from "@trpc/server";

import type { TRPCAppRouter } from "@/utils/trpc";

import { WorkflowDetailContent } from "@/components/workflow-detail-modal";

type WorkflowRun =
  inferRouterOutputs<TRPCAppRouter>["workflow"]["listRuns"][number];
type WorkflowEvents = inferRouterOutputs<TRPCAppRouter>["workflow"]["events"];
type WorkflowReasoningResult =
  inferRouterOutputs<TRPCAppRouter>["workflow"]["reasoning"];

const baseWorkflow = {
  id: "run-123",
  workflowId: "workflow-xyz",
  status: "completed",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  inputData: { requirement: "Test" },
} as WorkflowRun;

describe("WorkflowDetailContent", () => {
  it("renders rag provenance and triggers navigation", () => {
    const navigateCalls: string[] = [];
    const onNavigate = (docId: string) => navigateCalls.push(docId);
    const ragDocs: WorkflowReasoningResult["provenance"]["ragDocuments"] = [
      { documentId: "doc-1", label: "Doc One" },
    ];
    const events: WorkflowEvents = [];

    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="overview"
        events={events}
        eventsLoading={false}
        onNavigateToMindscape={onNavigate}
        onTabChange={() => {}}
        ragDocs={ragDocs}
        reasoningError={null}
        reasoningLoading={false}
        workflow={baseWorkflow}
      />
    );

    const viewButton = getByText("View in Mindscape");
    fireEvent.click(viewButton);
    expect(navigateCalls).toEqual(["doc-1"]);
  });

  it("renders the empty provenance state when no documents are provided", () => {
    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="overview"
        events={[]}
        eventsLoading={false}
        onTabChange={() => {}}
        ragDocs={[]}
        reasoningError={null}
        reasoningLoading={false}
        workflow={baseWorkflow}
      />
    );

    expect(getByText("No RAG documents linked for this run.")).toBeTruthy();
  });

  it("surfaces a provenance error when reasoning fails", () => {
    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="overview"
        events={[]}
        eventsLoading={false}
        onTabChange={() => {}}
        ragDocs={[]}
        reasoningError={new Error("boom")}
        reasoningLoading={false}
        workflow={{ ...baseWorkflow, status: "failed" }}
      />
    );

    expect(
      getByText("Unable to load provenance. Please retry in a moment.")
    ).toBeTruthy();
  });

  it("renders workflow events in the events tab", () => {
    const events: WorkflowEvents = [
      {
        id: "evt-1",
        eventType: "step.started",
        timestamp: new Date().toISOString(),
        eventData: { info: "Booting" },
      },
    ];

    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="events"
        events={events}
        eventsLoading={false}
        onTabChange={() => {}}
        ragDocs={[]}
        reasoningError={null}
        reasoningLoading={false}
        workflow={baseWorkflow}
      />
    );

    expect(getByText("step.started")).toBeTruthy();
    expect(getByText(/"info":\s+"Booting"/)).toBeTruthy();
  });
});
