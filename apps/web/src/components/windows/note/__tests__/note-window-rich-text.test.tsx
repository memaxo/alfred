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
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

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

mock.module("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="rich-editor"
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
}));

import { NoteWindow } from "../note-window-rich-text";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("NoteWindow (rich text)", () => {
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
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
        "uuid-note-rt-1"
      );
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires content before saving (markdown mode)", async () => {
    const { container, getByPlaceholderText } = render(
      (
        <NoteWindow
          data={{ type: "note", viewMode: "full", editorMode: "markdown" }}
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
      "Write your note in Markdown..."
    ) as HTMLTextAreaElement;
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(insertNoteMock).not.toHaveBeenCalled();
  });

  it("saves content and updates window label/resourceRef (markdown mode)", async () => {
    const { getByPlaceholderText, getByText } = render(
      (
        <NoteWindow
          data={{ type: "note", viewMode: "full", editorMode: "markdown" }}
          id="nwin"
          selected={false}
        />
      ) as any,
      { wrapper: createWrapper() }
    );

    const user = userEvent.setup();
    await user.type(
      getByPlaceholderText("Write your note in Markdown..."),
      "Hello"
    );
    await user.click(getByText("Save"));

    expect(insertNoteMock).toHaveBeenCalledTimes(1);
    expect(updateWindowDataMock).toHaveBeenCalledWith("nwin", {
      resourceRef: { type: "note", id: "uuid-note-rt-1" },
      label: "Untitled Note",
      editorMode: "markdown",
    });
    expect(getByText("Edit")).toBeTruthy();
  });
});
