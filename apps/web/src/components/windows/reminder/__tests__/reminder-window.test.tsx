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

const insertReminderMock = vi.fn();
const deleteReminderMock = vi.fn();
const fireReminderMock = vi.fn();
const updateWindowDataMock = vi.fn();
const removeWindowMock = vi.fn();

let liveReminders: unknown[] | undefined = [];
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

mock.module("@tanstack/react-db", () => ({
  useLiveQuery: () => ({ data: liveReminders, isLoading: liveLoading }),
}));

mock.module("@/collections", () => ({
  useReminderCollection: () => ({
    collection: { __type: "reminder-collection" },
    insertReminder: insertReminderMock,
    deleteReminder: deleteReminderMock,
    fireReminder: fireReminderMock,
  }),
}));

mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: any) => unknown) =>
    selector({
      updateWindowData: updateWindowDataMock,
      removeWindow: removeWindowMock,
    }),
}));

mock.module("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { ReminderWindow } from "../reminder-window";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ReminderWindow", () => {
  beforeEach(() => {
    mockLOD = "full";
    liveReminders = [];
    liveLoading = false;
    insertReminderMock.mockReset();
    deleteReminderMock.mockReset();
    fireReminderMock.mockReset();
    updateWindowDataMock.mockReset();
    removeWindowMock.mockReset();
    if (globalThis.crypto?.randomUUID) {
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-rem-1");
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires title before saving", async () => {
    const { container, getByPlaceholderText } = render(
      (
        <ReminderWindow
          data={{ type: "reminder", viewMode: "full" }}
          id="rwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const formEl = container.querySelector("form");
    expect(formEl).toBeTruthy();
    await act(async () => {
      fireEvent.submit(formEl as HTMLFormElement);
      await Promise.resolve();
    });

    const input = getByPlaceholderText("Reminder title") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(insertReminderMock).not.toHaveBeenCalled();
  });

  it("creates reminder, updates window label and resourceRef", async () => {
    const { container, getByPlaceholderText, getByText } = render(
      (
        <ReminderWindow
          data={{ type: "reminder", viewMode: "full" }}
          id="rwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    await user.type(getByPlaceholderText("Reminder title"), "Pay bills");
    const dueInput = container.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement | null;
    expect(dueInput).toBeTruthy();
    fireEvent.change(dueInput as HTMLInputElement, {
      target: { value: "2026-01-19T10:00" },
    });
    await user.click(getByText("Save"));
    await Promise.resolve();

    expect(insertReminderMock).toHaveBeenCalledTimes(1);
    const arg = insertReminderMock.mock.calls[0]?.[0] as {
      title?: unknown;
      description?: unknown;
      due?: unknown;
    };
    expect(arg.title).toBe("Pay bills");
    expect(typeof arg.due).toBe("string");
    expect(String(arg.due)).toContain("T");

    expect(updateWindowDataMock).toHaveBeenCalledWith("rwin", {
      resourceRef: { type: "reminder", id: "uuid-rem-1" },
      label: "Pay bills",
    });
    expect(getByText("Edit")).toBeTruthy();
  });
});
