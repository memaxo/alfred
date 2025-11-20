import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import { BookmarkPane, type BookmarkPaneItem } from "@alfred/ui";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaneLayout } from "@/components/pane-layout";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/book")({
  component: BookRoute,
  errorComponent: RouteError,
});

function BookRoute() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const listInput = useMemo(() => ({ limit: 50, offset: 0 }), []);

  const bookListQuery = trpc.book.list.useQuery(listInput);
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type BookListItem = RouterOutputs["book"]["list"][number];
  const bookmarks: BookListItem[] = bookListQuery.data ?? [];
  const isLoading = bookListQuery.isLoading;

  const createBook = trpc.book.create.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate(listInput);
      setTitle("");
      setUrl("");
      setTags("");
    },
  });

  const deleteBook = trpc.book.delete.useMutation({
    onSuccess: async () => {
      await utils.book.list.invalidate(listInput);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      return;
    }
    
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      // Invalid URL - could show error toast here
      return;
    }

    const input: RouterInputs["book"]["create"] = {
      title: title.trim() || undefined,
      url: url.trim(),
      tags: tags.trim() 
        ? tags.split(",").map(t => t.trim()).filter(t => t.length > 0)
        : undefined,
    };
    createBook.mutate(input);
  };

  const handleDelete = (id: string) => {
    const input: RouterInputs["book"]["delete"] = { id };
    deleteBook.mutate(input);
  };

  const paneItems: BookmarkPaneItem[] = useMemo(
    () =>
      bookmarks.map((bookmark) => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        tags: bookmark.tags ?? null,
        createdAt: bookmark.createdAt ? bookmark.createdAt.toISOString() : null,
      })),
    [bookmarks]
  );

  const createForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bookmark-url">URL</Label>
        <Input
          id="bookmark-url"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bookmark-title">Title (optional)</Label>
        <Input
          id="bookmark-title"
          type="text"
          placeholder="e.g., Documentation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bookmark-tags">Tags (comma-separated, optional)</Label>
        <Input
          id="bookmark-tags"
          type="text"
          placeholder="e.g., docs, reference"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={createBook.isPending}
      >
        {createBook.isPending ? "Saving..." : "Add Bookmark"}
      </Button>
    </form>
  );

  const paneComponent = isLoading ? (
    <div className="text-biolum-dim text-center py-8">Loading bookmarks...</div>
  ) : (
    <BookmarkPane items={paneItems} onDelete={handleDelete} />
  );

  return (
    <PaneLayout
      title="Bookmarks"
      description="Save and organize your favorite links."
      createForm={createForm}
      paneComponent={paneComponent}
    />
  );
}

