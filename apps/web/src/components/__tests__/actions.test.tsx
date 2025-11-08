import "@/test/dom";
import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AssistantAction } from "@/hooks/use-assistant-stream";
import { Actions } from "../actions";

describe("Actions", () => {
  const createAction = (
    overrides?: Partial<AssistantAction>
  ): AssistantAction => ({
    id: "tool-1",
    name: "search",
    args: { query: "alfred" },
    status: "running",
    result: undefined,
    error: undefined,
    ...overrides,
  });

  it("renders nothing when actions array is empty", () => {
    const { container } = render(<Actions actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders action with status icon", () => {
    const action = createAction();
    render(<Actions actions={[action]} />);
    expect(screen.getByText("search")).toBeInTheDocument();
    expect(screen.getByText("Tool Activity")).toBeInTheDocument();
  });

  it("collapses and expands tool details on click", () => {
    const action = createAction();
    render(<Actions actions={[action]} />);

    const toggle = screen.getByRole("button", { expanded: false });
    expect(screen.queryByText(/Input/i)).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getByText(/Input/i)).toBeInTheDocument();
    expect(screen.getByText(/alfred/i)).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText(/Input/i)).toBeNull();
  });

  it("displays action args when expanded", () => {
    const action = createAction({ args: { query: "test", limit: 10 } });
    render(<Actions actions={[action]} />);

    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);

    const pre = screen.getByText(/query/i).closest("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain("test");
    expect(pre?.textContent).toContain("10");
  });

  it("displays action result when expanded", () => {
    const action = createAction({
      status: "completed",
      result: { items: ["result1", "result2"] },
    });
    render(<Actions actions={[action]} />);

    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);

    expect(screen.getByText(/Output/i)).toBeInTheDocument();
    expect(screen.getByText(/result1/i)).toBeInTheDocument();
  });

  it("displays error when action fails", () => {
    const action = createAction({
      status: "error",
      error: "Failed to execute",
    });
    render(<Actions actions={[action]} />);

    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);

    expect(screen.getByText(/Failed to execute/i)).toBeInTheDocument();
  });

  it("handles multiple actions independently", () => {
    const actions = [
      createAction({ id: "tool-1", name: "search" }),
      createAction({ id: "tool-2", name: "create" }),
    ];
    render(<Actions actions={actions} />);

    const toggles = screen.getAllByRole("button");
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    expect(screen.getByText(/search/i)).toBeInTheDocument();
    expect(screen.queryByText(/create/i)).toBeNull();

    fireEvent.click(toggles[1]);
    expect(screen.getByText(/create/i)).toBeInTheDocument();
  });
});
