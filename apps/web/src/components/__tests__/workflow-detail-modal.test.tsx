/**
 * Tests for WorkflowDetailContent - Work compilation tab
 */

import "@/test/dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";

let compilationState:
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "data"; data: unknown }
  | { kind: "empty" } = { kind: "empty" };

mock.module("@/utils/trpc", () => ({
  trpc: {
    workflow: {
      compilation: {
        get: {
          useQuery: () => {
            if (compilationState.kind === "loading") {
              return { isLoading: true, isError: false, data: undefined };
            }
            if (compilationState.kind === "error") {
              return {
                isLoading: false,
                isError: true,
                error: { message: compilationState.message },
                data: undefined,
              };
            }
            if (compilationState.kind === "data") {
              return {
                isLoading: false,
                isError: false,
                data: compilationState.data,
              };
            }
            return { isLoading: false, isError: false, data: null };
          },
        },
      },
    },
  },
}));

mock.module("@/components/tremor", () => ({
  BiolumBadge: ({ children }: { children: unknown }) => (
    <div data-testid="badge">{String(children)}</div>
  ),
}));

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: unknown }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: unknown }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

import { WorkflowDetailContent } from "../workflow-detail-modal";

describe("WorkflowDetailContent work tab", () => {
  afterEach(() => {
    cleanup();
    compilationState = { kind: "empty" };
  });

  it("renders compilation summary when available", () => {
    compilationState = {
      kind: "data",
      data: {
        status: "completed",
        summaryText: "Implemented changes and updated docs.",
        totalDurationMs: 1234,
        agentsSpawned: 1,
        learningInsights: 0,
        fileChanges: { created: ["docs/report.md"], modified: [], deleted: [] },
        agents: [
          {
            agentId: "agent-1",
            status: "completed",
            result: { summary: "Implemented changes" },
          },
        ],
      },
    };

    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="work"
        events={[] as any}
        eventsLoading={false}
        onTabChange={() => {}}
        ragDocs={[] as any}
        reasoningError={null}
        reasoningLoading={false}
        workflow={
          {
            id: "run-1",
            workflowId: "pipeline",
            status: "completed",
            created: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          } as any
        }
      />
    );

    expect(getByText("Completion Summary")).toBeTruthy();
    expect(getByText("Implemented changes and updated docs.")).toBeTruthy();
    expect(getByText("Agents")).toBeTruthy();
  });

  it("renders empty state when compilation missing", () => {
    compilationState = { kind: "empty" };

    const { getByText } = render(
      <WorkflowDetailContent
        activeTab="work"
        events={[] as any}
        eventsLoading={false}
        onTabChange={() => {}}
        ragDocs={[] as any}
        reasoningError={null}
        reasoningLoading={false}
        workflow={
          {
            id: "run-1",
            workflowId: "pipeline",
            status: "completed",
            created: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          } as any
        }
      />
    );

    expect(
      getByText("No work compilation is available for this run yet.")
    ).toBeTruthy();
  });
});
