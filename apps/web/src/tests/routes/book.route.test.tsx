import "../../test/reset-mocks";
import { describe, expect, it } from "bun:test";

import { Route as BookRoute } from "@/routes/_protected/book";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";

import { fireEvent, waitFor } from "../../test/testing-library";

describe("BookRoute", () => {
  const BookView = BookRoute.options.component as unknown as () => JSX.Element;

  describe("BookmarkCreateForm", () => {
    it("renders URL, title, tags and description inputs", () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      expect(view.getByLabelText(/url/i)).toBeTruthy();
      expect(view.getByLabelText(/title/i)).toBeTruthy();
      expect(view.getByLabelText(/tags/i)).toBeTruthy();
      expect(view.getByLabelText(/description/i)).toBeTruthy();
      expect(view.getByRole("button", { name: /add bookmark/i })).toBeTruthy();
      view.unmount();
    });

    it("normalizes URL and omits empty tags", async () => {
      let createInput: {
        url: string;
        tags?: string[];
        title?: string;
        description?: string;
      } | null = null;
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
        mutations: {
          "book.create": (input) => {
            createInput = input as {
              url: string;
              tags?: string[];
              title?: string;
              description?: string;
            };
            return {
              id: "book-1",
              url: createInput.url,
              title: createInput.title ?? null,
              tags: createInput.tags ?? null,
            };
          },
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      const urlInput = view.getByLabelText(/url/i) as HTMLInputElement;
      fireEvent.input(urlInput, { target: { value: "example.com" } });
      await waitFor(() => {
        expect(urlInput.value).toBe("example.com");
      });

      const submitButton = view.getByRole("button", { name: /add bookmark/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createInput).not.toBeNull();
        expect(createInput?.url).toBe("https://example.com");
        expect(createInput?.tags).toBeUndefined();
      });
      view.unmount();
    });

    it("parses comma-separated tags and trims values", async () => {
      let createInput: { url: string; tags?: string[] } | null = null;
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
        mutations: {
          "book.create": (input) => {
            createInput = input as { url: string; tags?: string[] };
            return { id: "book-2" };
          },
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      const urlInput = view.getByLabelText(/url/i) as HTMLInputElement;
      const tagsInput = view.getByLabelText(/tags/i) as HTMLInputElement;
      fireEvent.input(urlInput, {
        target: { value: "https://example.com" },
      });
      fireEvent.input(tagsInput, {
        target: { value: " ai, research,  , ai " },
      });
      await waitFor(() => {
        expect(urlInput.value).toBe("https://example.com");
        expect(tagsInput.value).toBe(" ai, research,  , ai ");
      });

      fireEvent.click(view.getByRole("button", { name: /add bookmark/i }));

      await waitFor(() => {
        expect(createInput?.tags).toEqual(["ai", "research"]);
      });
      view.unmount();
    });
  });

  describe("BookPane", () => {
    it("renders empty state when no bookmarks", async () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText(/no bookmarks yet/i)).toBeTruthy();
      });
      view.unmount();
    });

    it("renders bookmarks list", async () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [
            {
              id: "book-1",
              url: "https://alfred.example.com",
              title: "Alfred Documentation",
              tags: ["docs", "internal"],
              description: null,
              created: new Date(),
            },
          ],
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Alfred Documentation")).toBeTruthy();
        expect(view.getByText("alfred.example.com")).toBeTruthy();
        expect(view.getByText("docs")).toBeTruthy();
        expect(view.getByText("internal")).toBeTruthy();
      });
      view.unmount();
    });

    it("deletes bookmark on Delete click", async () => {
      let deletedId: string | null = null;
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [
            {
              id: "book-delete",
              url: "https://example.com",
              title: "Delete Me",
              description: null,
              tags: ["test"],
              created: new Date(),
            },
          ],
        },
        mutations: {
          "book.delete": (input) => {
            deletedId = (input as { id: string }).id;
            return { deleted: 1 };
          },
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Delete Me")).toBeTruthy();
      });

      const confirmOriginal = window.confirm;
      try {
        window.confirm = () => true;
        fireEvent.click(view.getByRole("button", { name: /^delete$/i }));
        await waitFor(() => {
          expect(deletedId).toBe("book-delete");
        });
      } finally {
        window.confirm = confirmOriginal;
      }

      view.unmount();
    });

    it("filters bookmarks by search query and tag", async () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [
            {
              id: "book-1",
              url: "https://bun.sh",
              title: "Bun Runtime",
              description: "Fast JavaScript runtime",
              tags: ["runtime", "js"],
              created: new Date(),
            },
            {
              id: "book-2",
              url: "https://openai.com",
              title: "OpenAI",
              description: "AI research",
              tags: ["ai"],
              created: new Date(),
            },
            {
              id: "book-3",
              url: "https://tanstack.com/router",
              title: "TanStack Router",
              description: null,
              tags: ["router", "react"],
              created: new Date(),
            },
          ],
        },
      };

      const view = renderRoute(<BookView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Bun Runtime")).toBeTruthy();
        expect(view.getByText("OpenAI")).toBeTruthy();
        expect(view.getByText("TanStack Router")).toBeTruthy();
      });

      fireEvent.input(view.getByPlaceholderText(/search bookmarks/i), {
        target: { value: "open" },
      });

      await waitFor(() => {
        expect(view.getByText("OpenAI")).toBeTruthy();
        expect(view.queryByText("Bun Runtime")).toBeNull();
        expect(view.queryByText("TanStack Router")).toBeNull();
      });

      fireEvent.input(view.getByPlaceholderText(/search bookmarks/i), {
        target: { value: "" },
      });
      fireEvent.input(view.getByPlaceholderText(/filter by tag/i), {
        target: { value: "router" },
      });

      await waitFor(() => {
        expect(view.getByText("TanStack Router")).toBeTruthy();
        expect(view.queryByText("OpenAI")).toBeNull();
      });

      view.unmount();
    });
  });
});
