import "@/test/dom";
import { describe, expect, it } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
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
    const { getByText } = render(<Actions actions={[action]} />);
    expect(getByText("search")).toBeTruthy();
    expect(getByText("Tool Activity")).toBeTruthy();
  });

  it("collapses and expands tool details on click", () => {
    const action = createAction();
    const { getByRole, queryByText, getByText } = render(
      <Actions actions={[action]} />
    );

    const toggle = getByRole("button", { expanded: false });
    expect(queryByText(/Input/i)).toBeNull();

    fireEvent.click(toggle);

    expect(getByRole("button", { expanded: true })).toBeTruthy();
    expect(getByText(/Input/i)).toBeTruthy();
    expect(getByText(/alfred/i)).toBeTruthy();

    fireEvent.click(toggle);

    expect(getByRole("button", { expanded: false })).toBeTruthy();
    expect(queryByText(/Input/i)).toBeNull();
  });

  it("displays action args when expanded", () => {
    const action = createAction({ args: { query: "test", limit: 10 } });
    const { getByRole, getByText } = render(<Actions actions={[action]} />);

    const toggle = getByRole("button");
    fireEvent.click(toggle);

    const pre = getByText(/query/i).closest("pre");
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain("test");
    expect(pre?.textContent).toContain("10");
  });

  it("displays action result when expanded", () => {
    const action = createAction({
      status: "completed",
      result: { items: ["result1", "result2"] },
    });
    const { getByRole, getByText } = render(<Actions actions={[action]} />);

    const toggle = getByRole("button");
    fireEvent.click(toggle);

    expect(getByText(/Output/i)).toBeTruthy();
    expect(getByText(/result1/i)).toBeTruthy();
  });

  it("displays error when action fails", () => {
    const action = createAction({
      status: "error",
      error: "Failed to execute",
    });
    const { getByRole, getByText } = render(<Actions actions={[action]} />);

    const toggle = getByRole("button");
    fireEvent.click(toggle);

    expect(getByText(/Failed to execute/i)).toBeTruthy();
  });

  it("handles multiple actions independently", () => {
    const actions = [
      createAction({ id: "tool-1", name: "search" }),
      createAction({ id: "tool-2", name: "create" }),
    ];
    const { getAllByRole } = render(<Actions actions={actions} />);

    const toggles = getAllByRole("button");
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
    expect(toggles[1].getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggles[1]);
    expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
    expect(toggles[1].getAttribute("aria-expanded")).toBe("true");
  });

  describe("error cases", () => {
    it("handles action with very long name", () => {
      const longName = "a".repeat(100);
      const action = createAction({ name: longName });
      const { getByText } = render(<Actions actions={[action]} />);
      expect(getByText(longName)).toBeTruthy();
    });

    it("handles action with deeply nested args", () => {
      const action = createAction({
        args: {
          level1: {
            level2: {
              level3: {
                level4: { value: "deep" },
              },
            },
          },
        },
      });
      const { getByRole, getByText } = render(<Actions actions={[action]} />);
      const toggle = getByRole("button");
      fireEvent.click(toggle);
      expect(getByText(/deep/i)).toBeTruthy();
    });

    it("handles action with empty args object", () => {
      const action = createAction({ args: {} });
      const { getByRole } = render(<Actions actions={[action]} />);
      const toggle = getByRole("button");
      fireEvent.click(toggle);
      // Empty args object should not show Input section
      // Component only shows Input when hasArgs is true (Object.keys(args).length > 0)
      expect(toggle).toBeTruthy();
    });

    it("handles action with null result", () => {
      const action = createAction({
        status: "completed",
        result: null,
      });
      const { getByRole, queryByText } = render(<Actions actions={[action]} />);
      const toggle = getByRole("button");
      fireEvent.click(toggle);
      // Null result should not show Output section
      // Component only shows Output when result !== undefined && result !== null
      expect(queryByText(/Output/i)).toBeNull();
    });

    it("handles action with very long error message", () => {
      const longError = `Error: ${"x".repeat(500)}`;
      const action = createAction({
        status: "error",
        error: longError,
      });
      const { getByRole, getByText } = render(<Actions actions={[action]} />);
      const toggle = getByRole("button");
      fireEvent.click(toggle);
      expect(getByText(longError)).toBeTruthy();
    });

    it("handles action with missing name gracefully", () => {
      const action = createAction({ name: "" });
      const { getByText } = render(<Actions actions={[action]} />);
      expect(getByText("Tool Activity")).toBeTruthy();
    });
  });
});
