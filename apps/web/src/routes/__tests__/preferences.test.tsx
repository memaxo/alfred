import "@/test/dom";
import { beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { act } from "react";
import type { PreferenceDeleteInput, PreferenceSetInput } from "@alfred/type";

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

const listSetData = vi.fn();
const listCancel = vi.fn().mockResolvedValue(undefined);
const listInvalidate = vi.fn().mockResolvedValue(undefined);
const listGetData = vi.fn();

const optimisticPreference = {
  id: "pref-1",
  userId: "user-1",
  key: "theme",
  value: { mode: "dark" },
  confidence: 0.9,
  source: "user",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

let preferenceQueryResult: {
  data: typeof optimisticPreference[];
  isLoading: boolean;
  isFetching: boolean;
};

const setMutate = vi.fn();
const deleteMutate = vi.fn();

function createMutationStub<Input, Output>(spy: (input: Input) => void, result: Output) {
  return (config?: {
    onMutate?: (input: Input) => unknown | Promise<unknown>;
    onSuccess?: (data: Output, input: Input, context: unknown) => void | Promise<void>;
    onSettled?: (
      data: Output | undefined,
      error: Error | null,
      input: Input,
      context: unknown,
    ) => void | Promise<void>;
  }) => ({
    isPending: false,
    mutate: async (
      input: Input,
      options?: { onSuccess?: (data: Output, context: unknown) => void | Promise<void> },
    ) => {
      spy(input);
      const context = config?.onMutate ? await config.onMutate(input) : undefined;
      await config?.onSuccess?.(result, input, context);
      await options?.onSuccess?.(result, context);
      await config?.onSettled?.(result, null, input, context);
      return result;
    },
  });
}

const trpcMock = {
  useUtils: () => ({
    preference: {
      list: {
        cancel: listCancel,
        getData: listGetData,
        setData: listSetData,
        invalidate: listInvalidate,
      },
    },
  }),
  preference: {
    list: {
      useQuery: () => preferenceQueryResult,
    },
    set: {
      useMutation: createMutationStub<PreferenceSetInput, typeof optimisticPreference>(
        setMutate,
        optimisticPreference,
      ),
    },
    delete: {
      useMutation: createMutationStub<PreferenceDeleteInput, { removed: number }>(
        deleteMutate,
        { removed: 1 },
      ),
    },
  },
};

mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));

describe("Preferences route", () => {
  beforeEach(() => {
    preferenceQueryResult = {
      data: [optimisticPreference],
      isLoading: false,
      isFetching: false,
    };
    listSetData.mockClear();
    listCancel.mockClear();
    listInvalidate.mockClear();
    listGetData.mockReturnValue(preferenceQueryResult.data);
    setMutate.mockClear();
    deleteMutate.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("submits JSON preference values and resets the form", async () => {
    const routeModule = await import("../preferences");
    const Component = routeModule.Route.options.component;

    render(<Component />);

    fireEvent.change(screen.getByPlaceholderText("Preference key"), {
      target: { value: "notifications" },
    });
    fireEvent.change(screen.getByPlaceholderText('JSON value, e.g. {"mode":"dark"}'), {
      target: { value: '{"enabled":true}' },
    });
    fireEvent.change(screen.getByPlaceholderText("Confidence (0-1)"), {
      target: { value: "0.85" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save preference/i }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(setMutate).toHaveBeenCalledWith({
      key: "notifications",
      value: { enabled: true },
      confidence: 0.85,
    });
    expect(listSetData).toHaveBeenCalled();
    expect(listInvalidate).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Preference saved");
    expect((screen.getByPlaceholderText("Preference key") as HTMLInputElement).value).toBe("");
  });

  it("deletes a preference entry", async () => {
    const routeModule = await import("../preferences");
    const Component = routeModule.Route.options.component;

    render(<Component />);

    await act(async () => {
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(deleteMutate).toHaveBeenCalledWith({ key: "theme" });
    expect(listSetData).toHaveBeenCalled();
    expect(listInvalidate).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Preference removed");
  });
});
