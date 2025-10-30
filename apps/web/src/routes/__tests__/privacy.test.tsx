import "@/test/dom";
import { beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { act } from "react";
import type { PrivacyFactDeleteInput } from "@alfred/type";

const toastSuccess = vi.fn();
const toastError = vi.fn();

mock.module("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

let render: typeof import("@testing-library/react").render;
let fireEvent: typeof import("@testing-library/react")["fireEvent"];
let screen: typeof import("@testing-library/react").screen;

beforeAll(async () => {
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  fireEvent = rtl.fireEvent;
  screen = rtl.screen;
});

const factsSetData = vi.fn();
const factsCancel = vi.fn().mockResolvedValue(undefined);
const factsInvalidate = vi.fn().mockResolvedValue(undefined);
const factsGetData = vi.fn();

const deleteSpy = vi.fn();

let factsQueryResult: {
  data: Array<{
    id: string;
    content: string;
    category?: string | null;
    source?: string | null;
    confidence?: number | null;
    created?: string;
    updated?: string;
  }>;
  isLoading: boolean;
  isFetching: boolean;
};

let eventsQueryResult: {
  data: Array<{
    id: string;
    type: string;
    timestamp?: string;
    data: unknown;
    metadata?: unknown;
  }>;
  isLoading: boolean;
  isFetching: boolean;
};

function createDeleteMutation() {
  return (config?: {
    onMutate?: (input: PrivacyFactDeleteInput) => unknown | Promise<unknown>;
    onSuccess?: (
      data: { removed: number },
      input: PrivacyFactDeleteInput,
      context: unknown,
    ) => void | Promise<void>;
    onSettled?: (
      data: { removed: number } | undefined,
      error: Error | null,
      input: PrivacyFactDeleteInput,
      context: unknown,
    ) => void | Promise<void>;
  }) => ({
    isPending: false,
    mutate: async (input: PrivacyFactDeleteInput) => {
      deleteSpy(input);
      const context = config?.onMutate ? await config.onMutate(input) : undefined;
      const result = { removed: 1 };
      await config?.onSuccess?.(result, input, context);
      await config?.onSettled?.(result, null, input, context);
      return result;
    },
  });
}

const trpcMock = {
  useUtils: () => ({
    privacy: {
      facts: {
        cancel: factsCancel,
        getData: factsGetData,
        setData: factsSetData,
        invalidate: factsInvalidate,
      },
    },
  }),
  privacy: {
    facts: {
      useQuery: () => factsQueryResult,
    },
    events: {
      useQuery: () => eventsQueryResult,
    },
    deleteFact: {
      useMutation: createDeleteMutation(),
    },
  },
};

mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));

describe("Privacy route", () => {
  beforeEach(() => {
    factsQueryResult = {
      data: [
        {
          id: "fact-1",
          content: "User prefers email updates.",
          category: "communication",
          source: "user",
          confidence: 0.72,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isFetching: false,
    };
    eventsQueryResult = {
      data: [
        {
          id: "event-1",
          type: "tool_use",
          timestamp: new Date().toISOString(),
          data: { tool: "note" },
          metadata: { duration: 120 },
        },
      ],
      isLoading: false,
      isFetching: false,
    };
    factsSetData.mockClear();
    factsCancel.mockClear();
    factsInvalidate.mockClear();
    factsGetData.mockReturnValue(factsQueryResult.data);
    deleteSpy.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("renders facts and deletes an entry", async () => {
    const routeModule = await import("../privacy");
    const Component = routeModule.Route.options.component;

    render(<Component />);

    expect(screen.getByText("User prefers email updates.")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(deleteSpy).toHaveBeenCalledWith({ id: "fact-1" });
    expect(factsSetData).toHaveBeenCalled();
    expect(factsInvalidate).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Fact deleted");
  });
});
