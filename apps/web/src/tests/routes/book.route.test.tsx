import "../../test/reset-mocks";
import { describe, expect, it } from "bun:test";
import { BookRoute } from "@/routes/_protected/book";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { fireEvent, waitFor } from "../../test/testing-library";

describe("BookRoute", () => {
  describe("BookmarkCreateForm", () => {
    it("renders URL, title, tags and description inputs", () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
      };

      const view = renderRoute(<BookRoute />, {
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

    it("creates bookmark with URL", async () => {
      let createInput: any = null;
      const handlers: TestTrpcHandlers = {
        queries: {
          "book.list": () => [],
        },
        mutations: {
          "book.create": (input) => {
            createInput = input;
            return {
              id: "book-1",
              url: (input as any).url,
              title: (input as any).title,
              tags: (input as any).tags,
            };
          },
        },
      };

      const view = renderRoute(<BookRoute />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      const urlInput = view.getByLabelText(/url/i);
      fireEvent.change(urlInput, { target: { value: "https://example.com" } });

      const submitButton = view.getByRole("button", { name: /add bookmark/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createInput).not.toBeNull();
        expect(createInput?.url).toBe("https://example.com");
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

      const view = renderRoute(<BookRoute />, {
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
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };

      const view = renderRoute(<BookRoute />, {
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
  });
});
