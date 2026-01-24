import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import type { WindowComponentProps } from "@/components/desktop/windows/types";
import type { WindowInstance } from "@/store/desktop/types.new";

const spawnWindowMock = vi.fn();
vi.mock("@/store/desktop", () => ({
  useDesktopStore: vi.fn(
    (selector: (s: { spawnWindow: typeof spawnWindowMock }) => unknown) =>
      selector({ spawnWindow: spawnWindowMock })
  ),
}));

vi.mock("@/utils/trpc", () => {
  const utils = {
    attention: { list: { invalidate: vi.fn() } },
    delta: { list: { invalidate: vi.fn() } },
    focus: {
      active: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
      commitmentList: { invalidate: vi.fn() },
    },
  } as const;

  const activeQuery = {
    data: { id: "set-1", title: null, wipLimit: 5 },
    isLoading: false,
  } as const;
  const listQuery = { data: [], isLoading: false } as const;
  const attentionQuery = {
    data: [
      {
        id: "attn-1",
        title: "Needs input",
        kind: "pipeline_suspend:clarification",
        urgency: "high",
        status: "open",
        body: "Which option?",
        workflowRunId: "run-1",
      },
    ],
    isLoading: false,
  } as const;
  const mutation = { mutate: vi.fn(), isPending: false } as const;

  return {
    trpc: {
      useUtils: vi.fn(() => utils),
      focus: {
        active: { useQuery: vi.fn(() => activeQuery) },
        commitmentList: { useQuery: vi.fn(() => listQuery) },
        create: { useMutation: vi.fn(() => mutation) },
        commitmentCreate: { useMutation: vi.fn(() => mutation) },
        list: { useQuery: vi.fn(() => listQuery) },
      },
      attention: {
        list: { useQuery: vi.fn(() => attentionQuery) },
        resolve: { useMutation: vi.fn(() => mutation) },
        subscribe: { useSubscription: vi.fn() },
      },
      delta: {
        list: { useQuery: vi.fn(() => listQuery) },
        subscribe: { useSubscription: vi.fn() },
      },
    },
  };
});

import { FocusAppWindow } from "../index";

function createWindow(state: WindowInstance["state"]): WindowInstance {
  return {
    id: "win-focus",
    type: "focus",
    data: { type: "focus" as const },
    bounds: { x: 0, y: 0, width: 780, height: 560 },
    state,
    isTiled: false,
    zIndex: 1,
    isFocused: true,
    minSize: { width: 200, height: 150 },
    resizable: true,
    createdAt: 0,
    lastFocusedAt: 0,
  };
}

function createProps(
  state: WindowInstance["state"],
  overrides?: Partial<WindowComponentProps>
): WindowComponentProps {
  return {
    window: createWindow(state),
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onRestore: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onResizeStart: vi.fn(),
    onResizeEnd: vi.fn(),
    onDataChange: vi.fn(),
    ...overrides,
  };
}

describe("FocusAppWindow", () => {
  it("calls onClose on Escape", () => {
    const props = createProps("normal");
    const { container } = render(<FocusAppWindow {...props} />);

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).toBeTruthy();

    fireEvent.keyDown(root as HTMLElement, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onMinimize on Meta/Ctrl+M", () => {
    const props = createProps("normal");
    const { container } = render(<FocusAppWindow {...props} />);

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).toBeTruthy();

    fireEvent.keyDown(root as HTMLElement, { key: "m", ctrlKey: true });
    expect(props.onMinimize).toHaveBeenCalledTimes(1);
  });

  it("toggles maximize/restore on Meta/Ctrl+Enter", () => {
    const props1 = createProps("normal");
    const { container: c1 } = render(<FocusAppWindow {...props1} />);
    const root1 = c1.firstElementChild as HTMLElement | null;
    expect(root1).toBeTruthy();
    fireEvent.keyDown(root1 as HTMLElement, { key: "Enter", metaKey: true });
    expect(props1.onMaximize).toHaveBeenCalledTimes(1);

    const props2 = createProps("maximized");
    const { container: c2 } = render(<FocusAppWindow {...props2} />);
    const root2 = c2.firstElementChild as HTMLElement | null;
    expect(root2).toBeTruthy();
    fireEvent.keyDown(root2 as HTMLElement, { key: "Enter", metaKey: true });
    expect(props2.onRestore).toHaveBeenCalledTimes(1);
  });

  it("opens workflow run from attention item", () => {
    spawnWindowMock.mockReset();
    const props = createProps("normal");
    const { getByText } = render(<FocusAppWindow {...props} />);

    fireEvent.click(getByText("Open"));
    expect(spawnWindowMock).toHaveBeenCalledTimes(1);
    expect(spawnWindowMock).toHaveBeenCalledWith("workflow", {
      type: "workflow_run",
      id: "run-1",
    });
  });
});
