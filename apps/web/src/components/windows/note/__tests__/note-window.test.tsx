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

const insertNoteMock = vi.fn();
const updateNoteMock = vi.fn();
const deleteNoteMock = vi.fn();
const updateWindowDataMock = vi.fn();
const removeWindowMock = vi.fn();

let liveNotes: unknown[] | undefined = [];
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
  useLiveQuery: () => ({ data: liveNotes, isLoading: liveLoading }),
}));

mock.module("@/collections", () => ({
  useNoteCollection: () => ({
    collection: { __type: "note-collection" },
    insertNote: insertNoteMock,
    updateNote: updateNoteMock,
    deleteNote: deleteNoteMock,
  }),
}));

mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: any) => unknown) =>
    selector({
      updateWindowData: updateWindowDataMock,
      removeWindow: removeWindowMock,
    }),
}));

import { NoteWindow } from "../note-window";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("NoteWindow", () => {
  beforeEach(() => {
    mockLOD = "full";
    liveNotes = [];
    liveLoading = false;
    insertNoteMock.mockReset();
    updateNoteMock.mockReset();
    deleteNoteMock.mockReset();
    updateWindowDataMock.mockReset();
    removeWindowMock.mockReset();
    if (globalThis.crypto?.randomUUID) {
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-note-1");
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires content before saving a new note", async () => {
    const { container, getByPlaceholderText } = render(
      (
        <NoteWindow
          data={{ type: "note", viewMode: "full" }}
          id="nwin"
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

    const textarea = getByPlaceholderText(
      "Write your note..."
    ) as HTMLTextAreaElement;
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(insertNoteMock).not.toHaveBeenCalled();
  });

  it("creates a new note and updates window label/resourceRef", async () => {
    const { container, getByPlaceholderText, getByText } = render(
      (
        <NoteWindow
          data={{ type: "note", viewMode: "full" }}
          id="nwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const formEl = container.querySelector("form");
    expect(formEl).toBeTruthy();
    const user = userEvent.setup();
    await user.type(getByPlaceholderText("Write your note..."), "Hello world");
    await user.click(getByText("Save"));

    expect(insertNoteMock).toHaveBeenCalledTimes(1);
    expect(insertNoteMock).toHaveBeenCalledWith({
      title: null,
      content: "Hello world",
      tags: [],
    });
    expect(updateWindowDataMock).toHaveBeenCalledWith("nwin", {
      resourceRef: { type: "note", id: "uuid-note-1" },
      label: "Untitled Note",
    });
    expect(getByText("Edit")).toBeTruthy();
  });

  it("cancel resets draft values for existing note edits", async () => {
    liveNotes = [
      {
        id: "note-1",
        title: "Title",
        content: "Original",
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    ];

    const { getByText, getByPlaceholderText } = render(
      (
        <NoteWindow
          data={{
            type: "note",
            viewMode: "full",
            resourceRef: { type: "note", id: "note-1" },
          }}
          id="nwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(getByText("Edit"));
      await Promise.resolve();
    });

    const textarea = getByPlaceholderText(
      "Write your note..."
    ) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.input(textarea, { target: { value: "Changed" } });
      await Promise.resolve();
    });
    expect(textarea.value).toBe("Changed");

    await act(async () => {
      fireEvent.click(getByText("Cancel"));
      await Promise.resolve();
    });

    // Back in view mode; shows original content
    expect(getByText("Original")).toBeTruthy();
  });
});
