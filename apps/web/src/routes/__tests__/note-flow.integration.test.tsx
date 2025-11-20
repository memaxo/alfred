import "@/test/dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  const queryClient = createTestQueryClient();

  const snapshotNotes = () =>
    store.map((note) => ({
      ...note,
      createdAt: note.createdAt ?? new Date("2025-01-01T00:00:00Z"),
    }));

  const syncListCache = () => {
    const cacheEntry = queryClient
      .getQueryCache()
      .getAll()
      .find((query) => {
        const key = query.queryKey as unknown[];
        if (!Array.isArray(key) || key.length === 0) {
          return false;
        }
        const path = key[0];
        return (
          Array.isArray(path) &&
          path.length >= 2 &&
          path[0] === "note" &&
          path[1] === "list"
        );
      });

    if (cacheEntry) {
      queryClient.setQueryData(cacheEntry.queryKey, snapshotNotes());
    }
  };

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
      syncListCache();
      return next;
    }
  );
  const deleteSpy = vi.fn((input: { id: string }) => {
    options.onDelete?.(input);
    store = store.filter((note) => note.id !== input.id);
    syncListCache();
    return { id: input.id };
  });

  const trpcClient = createTestTrpcClient({
    queries: {
      "note.list": (input: unknown) => {
        listSpy(input);
        return snapshotNotes();
      },
    },
    mutations: {
      "note.create": createSpy,
      "note.delete": deleteSpy,
    },
  });

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
    const user = userEvent.setup();
    const view = renderNoteRoute(harness);
    const titleInput = view.getByPlaceholderText(
      /title \(optional\)/i
    ) as HTMLInputElement;
    const contentInput = view.getByPlaceholderText(
      /write your note/i
    ) as HTMLTextAreaElement;
    const saveButton = view.getByRole("button", { name: /save note/i });

    await user.type(titleInput, "Integration title");
    await user.type(contentInput, "End-to-end validation");

    await waitFor(() => {
      expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(titleInput.value).toBe("");
      expect(contentInput.value).toBe("");
    });
    await waitFor(() => {
      expect(harness.getStore()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(view.getByText(/end-to-end validation/i)).toBeTruthy();
      expect(harness.getStore()[0]).toMatchObject({
        title: "Integration title",
        content: "End-to-end validation",
      });
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

    expect(harness.getStore()).toHaveLength(1);
  });
});
