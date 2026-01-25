import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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

const invalidateMock = vi.fn();
const detectMutateMock = vi.fn();

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
    error: vi.fn(),
  },
}));

mock.module("@/utils/trpc", () => ({
  trpc: {
    useUtils: () => ({
      project: { list: { invalidate: invalidateMock } },
    }),
    project: {
      list: {
        useQuery: () => ({ data: [], isLoading: false, isFetching: false }),
      },
      detect: {
        useMutation: () => ({
          mutate: detectMutateMock,
          isPending: false,
        }),
      },
      linkLinear: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    linear: {
      getStatus: {
        useQuery: () => ({ data: { connected: false }, isLoading: false }),
      },
    },
  },
}));

import { ProjectWindow } from "../project-window";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ProjectWindow", () => {
  beforeEach(() => {
    mockLOD = "full";
    invalidateMock.mockReset();
    detectMutateMock.mockReset();
    detectMutateMock.mockImplementation((_input: unknown, opts?: any) => {
      opts?.onSuccess?.();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not detect project when workspace path is empty", () => {
    const { container } = render(
      (
        <ProjectWindow
          data={{ type: "project", viewMode: "full" }}
          id="pwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const formEl = container.querySelector("form");
    expect(formEl).toBeTruthy();
    act(() => {
      fireEvent.submit(formEl as HTMLFormElement);
    });

    expect(detectMutateMock).not.toHaveBeenCalled();
  });

  it("detects project with trimmed workspace path and resets input on success", async () => {
    const { getByPlaceholderText, getByRole } = render(
      (
        <ProjectWindow
          data={{ type: "project", viewMode: "full" }}
          id="pwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    const input = getByPlaceholderText("/path/to/project") as HTMLInputElement;
    await user.type(input, "  /tmp/proj  ");
    await user.click(getByRole("button", { name: "Detect" }));

    expect(detectMutateMock).toHaveBeenCalledTimes(1);
    expect(detectMutateMock.mock.calls[0]?.[0]).toEqual({
      workspace: "/tmp/proj",
    });
    expect(input.value).toBe("");
  });
});
