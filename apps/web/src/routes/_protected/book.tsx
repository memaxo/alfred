/**
 * Bookmark Management Route
 *
 * Provides UI for creating, listing, and deleting bookmarks.
 * Follows PaneLayout pattern with client-side filtering and tRPC integration.
 */

import { BookmarkPane, type BookmarkPaneItem } from "@alfred/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Globe, Loader2, Plus, Search, Tag } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PaneLayout } from "@/components/pane-layout";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/book")({
  component: BookRoute,
  errorComponent: RouteError,
});

/**
 * Form for creating new bookmarks
 */
function BookmarkCreateForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const utils = trpc.useUtils();
  const createBookmark = trpc.book.create.useMutation({
    onSuccess: async () => {
      toast.success("Bookmark saved");
      await utils.book.list.invalidate();
      setUrl("");
      setTitle("");
      setDescription("");
      setTags("");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to save bookmark");
    },
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        toast.error("URL is required");
        return;
      }

      // Basic URL validation
      try {
        if (
          trimmedUrl.startsWith("http://") ||
          trimmedUrl.startsWith("https://")
        ) {
          new URL(trimmedUrl);
        } else {
          // If no protocol, try prepending https://
          new URL(`https://${trimmedUrl}`);
        }
      } catch {
        toast.error("Please enter a valid URL");
        return;
      }

      const finalUrl =
        trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
          ? trimmedUrl
          : `https://${trimmedUrl}`;

      createBookmark.mutate({
        url: finalUrl,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        tags:
          tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean) || undefined,
      });
    },
    [createBookmark, url, title, description, tags]
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <div className="relative">
          <Globe className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
          <Input
            className="pl-9"
            id="url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com"
            required
            type="text"
            value={url}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resource Title"
            value={title}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
          <div className="relative">
            <Tag className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
            <Input
              className="pl-9"
              id="tags"
              onChange={(e) => setTags(e.target.value)}
              placeholder="research, ai, tech"
              value={tags}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          className="min-h-[80px]"
          id="description"
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this bookmark for?"
          value={description}
        />
      </div>

      <Button
        className="w-full rounded-full"
        disabled={createBookmark.isPending}
        type="submit"
      >
        {createBookmark.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </span>
        ) : (
          <>
            <Plus className="mr-1 h-4 w-4" />
            Add Bookmark
          </>
        )}
      </Button>
    </form>
  );
}

/**
 * List of bookmarks with filtering
 */
function BookPane() {
  const [filterTag, setFilterTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const utils = trpc.useUtils();
  const bookmarksQuery = trpc.book.list.useQuery({
    limit,
    offset: page * limit,
  });

  const deleteBookmark = trpc.book.delete.useMutation({
    onSuccess: async () => {
      toast.success("Bookmark deleted");
      await utils.book.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete bookmark");
    },
  });

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm("Are you sure you want to delete this bookmark?")) {
        deleteBookmark.mutate({ id });
      }
    },
    [deleteBookmark]
  );

  const filteredItems = useMemo<BookmarkPaneItem[]>(() => {
    let items = (bookmarksQuery.data ?? []) as BookmarkPaneItem[];

    if (filterTag) {
      const ft = filterTag.toLowerCase();
      items = items.filter((item) =>
        (item.tags as string[] | null)?.some((tag) =>
          tag.toLowerCase().includes(ft)
        )
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [bookmarksQuery.data, filterTag, searchQuery]);

  if (bookmarksQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-biolum-faint">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading bookmarks…
      </div>
    );
  }

  const hasMore = (bookmarksQuery.data?.length ?? 0) === limit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookmarks..."
            value={searchQuery}
          />
        </div>
        <div className="relative w-full sm:w-48">
          <Tag className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
          <Input
            className="pl-9"
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Filter by tag"
            value={filterTag}
          />
        </div>
      </div>

      <BookmarkPane items={filteredItems} onDelete={handleDelete} />

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-biolum-dim text-sm">Page {page + 1}</span>
          <Button
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Main Book Route Component
 */
export function BookRoute() {
  return (
    <PaneLayout
      createForm={<BookmarkCreateForm />}
      description="Save and organize web resources, articles, and research links"
      paneComponent={<BookPane />}
      title="Bookmarks"
    />
  );
}
