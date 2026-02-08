import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, mock, vi } from "bun:test";

mock.module("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: "dots" },
  Controls: ({ className }: { className?: string }) => (
    <div className={className} data-testid="controls" />
  ),
  Panel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel">{children}</div>
  ),
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  addEdge: vi.fn(),
  useEdgesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
  useNodesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
}));

let WorkflowCanvas: typeof import("../workflow-canvas").WorkflowCanvas;

const basePlan = {
  id: "plan-1",
  requirement: "Test workflow",
  phases: [
    {
      id: "phase-1",
      name: "Phase One",
      description: "First phase",
      agentType: "codex",
      estimatedDurationMs: 120_000,
      dependsOn: [],
      tasks: [],
    },
    {
      id: "phase-2",
      name: "Phase Two",
      description: "Second phase",
      agentType: "review",
      estimatedDurationMs: 90_000,
      dependsOn: [],
      tasks: [],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("WorkflowCanvas list view a11y", () => {
  beforeAll(async () => {
    ({ WorkflowCanvas } = await import("../workflow-canvas"));
  });

  it("opens list view and supports keyboard navigation", () => {
    const { getAllByRole, getByRole, queryByRole } = render(
      <WorkflowCanvas plan={basePlan} />
    );

    fireEvent.click(getByRole("button", { name: /list view/i }));

    const dialog = getByRole("dialog", { name: /phases list view/i });
    expect(dialog).toBeTruthy();

    const options = getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(queryByRole("dialog", { name: /phases list view/i })).toBeNull();
  });
});
