import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

let mockLOD: "tiny" | "small" | "full" = "full";

const insertTodoMock = vi.fn();
const toggleTodoMock = vi.fn();
const deleteTodoMock = vi.fn();
const updateWindowDataMock = vi.fn();

let liveTodos: unknown[] = [];
let liveLoading = false;

mock.module("@/components/windows/shared", () => ({
  useLOD: () => mockLOD,
  TinyDot: () => <div data-testid="tiny-dot" />,
  SmallCard: ({ label }: { label: string }) => (
    <div data-testid="small-card">{label}</div>
  ),
  WindowFrame: ({ children }: { children: ReactNode }) => (
    <div data-testid="window-frame">{children}</div>
  ),
}));

mock.module("@/collections/provider", () => ({
  useTodoCollection: () => ({
    collection: { __type: "todo-collection" },
    insertTodo: insertTodoMock,
    toggleTodo: toggleTodoMock,
    deleteTodo: deleteTodoMock,
  }),
}));

mock.module("@tanstack/react-db", () => ({
  useLiveQuery: () => ({ data: liveTodos, isLoading: liveLoading }),
}));

mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: any) => unknown) =>
    selector({
      updateWindowData: updateWindowDataMock,
    }),
}));

import { TodoWindow } from "../todo-window";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("TodoWindow", () => {
  beforeEach(() => {
    mockLOD = "full";
    liveTodos = [];
    liveLoading = false;
    insertTodoMock.mockReset();
    toggleTodoMock.mockReset();
    deleteTodoMock.mockReset();
    updateWindowDataMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not insert todo when submitted with empty text", () => {
    const { container, getByPlaceholderText } = render(
      (
        <TodoWindow
          data={{ type: "todo", viewMode: "full" }}
          id="w1"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const input = getByPlaceholderText("Add a task") as HTMLInputElement;
    const formEl = container.querySelector("form");
    expect(formEl).toBeTruthy();
    act(() => {
      fireEvent.input(input, { target: { value: "   " } });
      fireEvent.submit(formEl as HTMLFormElement);
    });

    expect(insertTodoMock).not.toHaveBeenCalled();
  });

  it("inserts trimmed todo and clears input", async () => {
    const { getByPlaceholderText, getByRole } = render(
      (
        <TodoWindow
          data={{ type: "todo", viewMode: "full" }}
          id="w1"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    const input = getByPlaceholderText("Add a task") as HTMLInputElement;
    await user.type(input, "  Buy milk  ");
    await user.click(getByRole("button", { name: "Add" }));

    expect(insertTodoMock).toHaveBeenCalledTimes(1);
    expect(insertTodoMock).toHaveBeenCalledWith({ text: "Buy milk" });
    expect(input.value).toBe("");
  });

  it("updates filter and persists filter to window draft", () => {
    const { getByText } = render(
      (
        <TodoWindow
          data={{ type: "todo", viewMode: "full", filter: "all" }}
          id="w1"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    act(() => {
      fireEvent.click(getByText("Completed"));
    });

    expect(updateWindowDataMock).toHaveBeenCalledWith("w1", {
      draft: { filter: "completed" },
    });
    expect(getByText("No completed tasks yet")).toBeTruthy();
  });
});
