import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

let mockLOD: "tiny" | "small" | "full" = "full";

const updateWindowDataMock = vi.fn();
const toastErrorMock = vi.fn();
const startPlanningMock = vi.fn();
const clearPlanningMock = vi.fn();

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

mock.module("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
    info: vi.fn(),
  },
}));

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: { updateWindowData: unknown }) => unknown) =>
    selector({
      updateWindowData: updateWindowDataMock,
    }),
}));

mock.module("@/hooks/use-workflow-phase", () => ({
  useWorkflowPlan: () => ({
    plan: null,
    status: "idle",
    error: null,
    steps: [],
    start: startPlanningMock,
    stop: vi.fn(),
    clear: clearPlanningMock,
  }),
}));

mock.module("@/hooks/use-workflow-subscription", () => ({
  useWorkflowSubscription: () => ({
    run: vi.fn(),
    stop: vi.fn(),
    steps: [],
    status: "idle",
    error: null,
  }),
}));

mock.module("@/utils/trpc", () => ({
  trpc: {
    workflow: {
      get: {
        useQuery: () => ({ data: null, isSuccess: false, isError: false }),
      },
      events: {
        useQuery: () => ({ data: [] }),
      },
      listRuns: {
        useQuery: () => ({ data: [], refetch: vi.fn() }),
      },
      cancel: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      phase: {
        approveAndExecute: {
          useMutation: () => ({ mutate: vi.fn(), isPending: false }),
        },
        updatePlan: {
          useMutation: () => ({ mutate: vi.fn(), isPending: false }),
        },
        getPlan: {
          useQuery: () => ({ data: null }),
        },
      },
      streamPipeline: {
        useSubscription: () => ({}),
      },
      resumePipeline: {
        useSubscription: () => ({}),
      },
    },
  },
}));

mock.module("../execution-panel", () => ({
  ExecutionPanel: () => <div data-testid="execution-panel" />,
}));

mock.module("../workflow-canvas", () => ({
  WorkflowCanvas: () => <div data-testid="workflow-canvas" />,
}));

let WorkflowWindow: typeof import("../workflow-window").WorkflowWindow;

async function tick() {
  await Promise.resolve();
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("WorkflowWindow (start form)", () => {
  beforeAll(async () => {
    ({ WorkflowWindow } = await import("../workflow-window"));
  });

  beforeEach(() => {
    mockLOD = "full";
    updateWindowDataMock.mockReset();
    toastErrorMock.mockReset();
    startPlanningMock.mockReset();
    clearPlanningMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("requires requirement before starting", async () => {
    const { getByPlaceholderText, getByText } = render(
      <WorkflowWindow
        data={{ type: "workflow", viewMode: "full", requirement: "" }}
        id="wwin"
        selected={false}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(getByText("Start"));
      await tick();
    });

    const textarea = getByPlaceholderText(
      "What should the workflow accomplish?"
    ) as HTMLTextAreaElement;
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(updateWindowDataMock).not.toHaveBeenCalled();
  });

  it("writes trimmed requirement draft on start", async () => {
    const { getByText } = render(
      <WorkflowWindow
        data={{
          type: "workflow",
          viewMode: "full",
          requirement: "  Ship it  ",
        }}
        id="wwin"
        selected={false}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(getByText("Start"));
      await tick();
    });

    expect(updateWindowDataMock).toHaveBeenCalledTimes(1);
    const arg = updateWindowDataMock.mock.calls[0]?.[1];
    expect(typeof arg).toBe("object");
    expect(arg).not.toBeNull();
    const argObj = arg as Record<string, unknown>;
    expect(argObj.requirement).toBe("Ship it");
    expect(argObj.status).toBe("planning");
    expect(Array.isArray(argObj.messages)).toBe(true);
  });

  it("clicking Generate Plan triggers form submit", async () => {
    const { getByText } = render(
      <WorkflowWindow
        data={{ type: "workflow", viewMode: "full", requirement: "Do work" }}
        id="wwin"
        selected={false}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(getByText("Generate Plan"));
      await tick();
    });

    expect(updateWindowDataMock).toHaveBeenCalledTimes(1);
    const arg = updateWindowDataMock.mock.calls[0]?.[1];
    expect(typeof arg).toBe("object");
    expect(arg).not.toBeNull();
    const argObj = arg as Record<string, unknown>;
    expect(argObj.requirement).toBe("Do work");
    expect(argObj.status).toBe("planning");
  });
});
