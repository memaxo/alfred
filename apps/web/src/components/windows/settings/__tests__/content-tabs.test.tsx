import "@/test/dom";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const toastErrorMock = vi.fn();

const preferenceSetMutateMock = vi.fn();

mock.module("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
  },
}));

mock.module("@/utils/trpc", () => ({
  trpc: {
    voice: {
      listVoices: { useQuery: () => ({ data: [], isLoading: false }) },
      previewVoice: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    user: {
      getPreferences: {
        useQuery: () => ({ data: [{ key: "voice.tts", value: "voice-1" }] }),
      },
      setPreference: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    preference: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      set: {
        useMutation: () => ({
          mutate: preferenceSetMutateMock,
          isPending: false,
        }),
      },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({
      preference: { list: { invalidate: vi.fn() } },
      user: { getPreferences: { invalidate: vi.fn() } },
    }),
  },
}));

import { SettingsContent } from "../content-tabs";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SettingsContent (tabs)", () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
    preferenceSetMutateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows error when saving with empty key", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SettingsContent mode="full" />,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    await user.click(getByText("Preferences"));
    await user.type(getByPlaceholderText("value (string or JSON)"), "dark");
    await user.click(getByText("Save"));

    expect(toastErrorMock).toHaveBeenCalledWith("Preference key required");
    expect(preferenceSetMutateMock).not.toHaveBeenCalled();
  });

  it("shows error when saving with empty value", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SettingsContent mode="full" />,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    await user.click(getByText("Preferences"));
    await user.type(getByPlaceholderText("key (e.g. theme)"), "theme");
    await user.click(getByText("Save"));

    expect(toastErrorMock).toHaveBeenCalledWith("Preference value required");
    expect(preferenceSetMutateMock).not.toHaveBeenCalled();
  });

  it("submits parsed JSON value when applicable", async () => {
    const { getByText, getByPlaceholderText } = render(
      <SettingsContent mode="full" />,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    await user.click(getByText("Preferences"));
    await user.type(getByPlaceholderText("key (e.g. theme)"), "config");
    fireEvent.change(getByPlaceholderText("value (string or JSON)"), {
      target: { value: '{"a":1}' },
    });
    await user.click(getByText("Save"));

    expect(preferenceSetMutateMock).toHaveBeenCalledTimes(1);
    expect(preferenceSetMutateMock.mock.calls[0]?.[0]).toEqual({
      key: "config",
      value: { a: 1 },
      confidence: 1,
    });
  });
});
