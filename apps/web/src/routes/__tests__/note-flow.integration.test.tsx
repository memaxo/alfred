import "@/test/dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
} from "@/test/render-route";

type NoteRecord = {
  id: string;
  title?: string | null;
  content: string;
  createdAt?: Date;
};

type NoteHarnessOptions = {
  onCreate?: (input: { title?: string; content: string }) => void;
  onDelete?: (input: { id: string }) => void;
};

const noteRouteModule = await import("../note");
const NoteRouteComponent = noteRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!NoteRouteComponent) {
  throw new Error("Note route component is unavailable");
}

function createNoteHarness(
  initialNotes: NoteRecord[] = [],
  options: NoteHarnessOptions = {}
) {
  let store = initialNotes.map((note) => ({ ...note }));

  const listSpy = vi.fn((input: unknown) => input);
  const createSpy = vi.fn(
    (input: { title?: string; content: string }) => {
      options.onCreate?.(input);
      const next = {
        id: `note-${Math.random().toString(36).slice(2)}`,
        title: input.title ?? null,
        content: input.content,
        createdAt: new Date("2025-02-01T00:00:00Z"),
      };
      store = [next, ...store];
      return next;
    }
  );
  const deleteSpy = vi.fn((input: { id: string }) => {
    options.onDelete?.(input);
    store = store.filter((note) => note.id !== input.id);
    return { id: input.id };
  });

  const trpcClient = createTestTrpcClient({
    queries: {
      "note.list": (input: unknown) => {
        listSpy(input);
        return store.map((note) => ({
          ...note,
          createdAt: note.createdAt ?? new Date("2025-01-01T00:00:00Z"),
        }));
      },
    },
    mutations: {
      "note.create": createSpy,
      "note.delete": deleteSpy,
    },
  });

  const queryClient = createTestQueryClient();

  return {
    queryClient,
    trpcClient,
    listSpy,
    createSpy,
    deleteSpy,
    getStore: () => store,
  };
}

function renderNoteRoute(harness = createNoteHarness()) {
  return renderRoute(<NoteRouteComponent />, {
    queryClient: harness.queryClient,
    trpcClient: harness.trpcClient,
  });
}

describe("Notes route flow", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the note list provided by tRPC", async () => {
    const harness = createNoteHarness([
      {
        id: "note-1",
        title: "Existing",
        content: "Integration baseline",
        createdAt: new Date("2025-01-15T12:00:00Z"),
      },
      {
        id: "note-2",
        title: null,
        content: "Second entry",
        createdAt: new Date("2025-01-16T09:30:00Z"),
      },
    ]);

    const view = renderNoteRoute(harness);

    await waitFor(() => {
      expect(view.getByText(/integration baseline/i)).toBeTruthy();
      expect(view.getByText(/second entry/i)).toBeTruthy();
    });

    expect(harness.listSpy).toHaveBeenCalledTimes(1);
  });

  it("creates a note, refetches the list, and clears the form inputs", async () => {
    const harness = createNoteHarness();
    const view = renderNoteRoute(harness);
    const titleInput = view.getByPlaceholderText(
      /title \(optional\)/i
    ) as HTMLInputElement;
    const contentInput = view.getByPlaceholderText(
      /write your note/i
    ) as HTMLTextAreaElement;
    const saveButton = view.getByRole("button", { name: /save note/i });

    fireEvent.change(titleInput, { target: { value: "Integration title" } });
    fireEvent.change(contentInput, {
      target: { value: "End-to-end validation" },
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(view.getByText(/end-to-end validation/i)).toBeTruthy();
    });

    expect(titleInput.value).toBe("");
    expect(contentInput.value).toBe("");
    expect(harness.createSpy).toHaveBeenCalledWith({
      title: "Integration title",
      content: "End-to-end validation",
    });

    await waitFor(() => {
      expect(harness.listSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("deletes a note and removes it from the pane list", async () => {
    const harness = createNoteHarness([
      {
        id: "note-delete",
        title: "Remove me",
        content: "Delete flow target",
        createdAt: new Date("2025-01-20T08:00:00Z"),
      },
      {
        id: "note-keep",
        title: "Stay",
        content: "Second record",
        createdAt: new Date("2025-01-21T08:00:00Z"),
      },
    ]);
    const view = renderNoteRoute(harness);

    await waitFor(() => {
      expect(view.getByText(/delete flow target/i)).toBeTruthy();
    });

    const deleteButton = view.getAllByRole("button", { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(view.queryByText(/delete flow target/i)).toBeNull();
      expect(view.getByText(/second record/i)).toBeTruthy();
    });

    expect(harness.deleteSpy).toHaveBeenCalledWith({ id: "note-delete" });

    await waitFor(() => {
      expect(harness.listSpy).toHaveBeenCalledTimes(2);
    });
  });
});
