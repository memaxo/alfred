import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import type { WindowComponentProps } from "@/components/desktop/windows/types";
import type { WindowInstance } from "@/store/desktop/types.new";

vi.mock("@/utils/trpc", () => {
  // Keep hook return values stable across re-renders to avoid effect loops.
  const utils = { workingset: { get: { invalidate: vi.fn() } } } as const;
  const queryResult = {
    data: { items: [], focus: null },
    isLoading: false,
  } as const;
  const setMutation = { mutate: vi.fn(), isPending: false } as const;

  return {
    trpc: {
      useUtils: vi.fn(() => utils),
      workingset: {
        get: {
          useQuery: vi.fn(() => queryResult),
        },
        set: {
          useMutation: vi.fn(() => setMutation),
        },
      },
    },
  };
});

import { WorkingSetAppWindow } from "../index";

function createWindow(state: WindowInstance["state"]): WindowInstance {
  return {
    id: "win-workingset",
    type: "workingset",
    data: { type: "workingset" as const },
    bounds: { x: 0, y: 0, width: 600, height: 400 },
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

describe("WorkingSetAppWindow", () => {
  it("calls onClose on Escape", () => {
    const props = createProps("normal");
    const { container } = render(<WorkingSetAppWindow {...props} />);

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).toBeTruthy();

    fireEvent.keyDown(root as HTMLElement, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onMinimize on Meta/Ctrl+M", () => {
    const props = createProps("normal");
    const { container } = render(<WorkingSetAppWindow {...props} />);

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).toBeTruthy();

    fireEvent.keyDown(root as HTMLElement, { key: "m", ctrlKey: true });
    expect(props.onMinimize).toHaveBeenCalledTimes(1);
  });

  it("toggles maximize/restore on Meta/Ctrl+Enter", () => {
    const props1 = createProps("normal");
    const { container: c1 } = render(<WorkingSetAppWindow {...props1} />);
    const root1 = c1.firstElementChild as HTMLElement | null;
    expect(root1).toBeTruthy();
    fireEvent.keyDown(root1 as HTMLElement, { key: "Enter", metaKey: true });
    expect(props1.onMaximize).toHaveBeenCalledTimes(1);

    const props2 = createProps("maximized");
    const { container: c2 } = render(<WorkingSetAppWindow {...props2} />);
    const root2 = c2.firstElementChild as HTMLElement | null;
    expect(root2).toBeTruthy();
    fireEvent.keyDown(root2 as HTMLElement, { key: "Enter", metaKey: true });
    expect(props2.onRestore).toHaveBeenCalledTimes(1);
  });

  it("calls onBlur when focus leaves the app root", () => {
    const props = createProps("normal");
    const { container } = render(<WorkingSetAppWindow {...props} />);

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).toBeTruthy();

    fireEvent.blur(root as HTMLElement, { relatedTarget: document.body });
    expect(props.onBlur).toHaveBeenCalledTimes(1);
  });
});
