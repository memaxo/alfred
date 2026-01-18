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
import { z } from "zod";
import { PaneLayout } from "@/components/pane-layout";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppForm, useSubmitInvalidFocus } from "@/form";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/book")({
  component: BookRoute,
  errorComponent: RouteError,
});

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const hasProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://");
  const normalized = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    new URL(normalized);
  } catch {
    return null;
  }

  return normalized;
}

function parseTags(raw: string): string[] | undefined {
  const parts = raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (parts.length === 0) {
    return;
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const tag of parts) {
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 32) {
      break;
    }
  }

  return tags.length > 0 ? tags : undefined;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ? value : null;
}

/**
 * Form for creating new bookmarks
 */
function BookmarkCreateForm() {
  const utils = trpc.useUtils();
  const createBookmark = trpc.book.create.useMutation({
    onSuccess: async () => {
      toast.success("Bookmark saved");
      await utils.book.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to save bookmark");
    },
  });

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const schema = z.object({
    url: z
      .string()
      .refine((value) => value.trim().length > 0, {
        message: "URL is required",
      })
      .refine((value) => normalizeUrl(value) !== null, {
        message: "Please enter a valid URL",
      }),
    title: z.string(),
    tags: z.string(),
    description: z.string(),
  });

  const form = useAppForm({
    defaultValues: {
      url: "",
      title: "",
      tags: "",
      description: "",
    },
    onSubmitInvalid,
    validators: {
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      const normalizedUrl = normalizeUrl(value.url);
      if (!normalizedUrl) {
        toast.error("Please enter a valid URL");
        return;
      }
      const tagList = parseTags(value.tags);
      createBookmark.mutate(
        {
          url: normalizedUrl,
          title: value.title.trim() || undefined,
          description: value.description.trim() || undefined,
          ...(tagList ? { tags: tagList } : {}),
        },
        {
          onSuccess: () => {
            form.reset();
          },
        }
      );
    },
  });

  return (
    <form.AppForm>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        ref={ref}
      >
        <form.AppField name="url">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>URL</Label>
              <div className="relative">
                <Globe className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
                <Input
                  aria-invalid={field.state.meta.errors.length > 0}
                  className="pl-9"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="example.com"
                  type="text"
                  value={field.state.value}
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-sm" key={String(error)}>
                  {String(error?.message ?? error)}
                </p>
              ))}
            </div>
          )}
        </form.AppField>

        <div className="grid gap-4 md:grid-cols-2">
          <form.AppField name="title">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Title (optional)</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Resource Title"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-sm" key={String(error)}>
                    {String(error?.message ?? error)}
                  </p>
                ))}
              </div>
            )}
          </form.AppField>
          <form.AppField name="tags">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  Tags (optional, comma-separated)
                </Label>
                <div className="relative">
                  <Tag className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
                  <Input
                    className="pl-9"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="research, ai, tech"
                    value={field.state.value}
                  />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-sm" key={String(error)}>
                    {String(error?.message ?? error)}
                  </p>
                ))}
              </div>
            )}
          </form.AppField>
        </div>

        <form.AppField name="description">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Description (optional)</Label>
              <Textarea
                className="min-h-[80px]"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="What is this bookmark for?"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-sm" key={String(error)}>
                  {String(error?.message ?? error)}
                </p>
              ))}
            </div>
          )}
        </form.AppField>

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              className="w-full rounded-full"
              disabled={!canSubmit || isSubmitting || createBookmark.isPending}
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
          )}
        </form.Subscribe>
      </form>
    </form.AppForm>
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
    let items: BookmarkPaneItem[] = (bookmarksQuery.data ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description ?? null,
      url: b.url,
      tags: b.tags,
      createdAt: toIsoString(b.created),
    }));

    if (filterTag) {
      const ft = filterTag.toLowerCase();
      items = items.filter((item) =>
        item.tags?.some((tag) => tag.toLowerCase().includes(ft))
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

  if (bookmarksQuery.isError) {
    return (
      <div className="space-y-3 py-12 text-center text-biolum-dim">
        <p>Failed to load bookmarks.</p>
        <Button onClick={() => bookmarksQuery.refetch()} variant="outline">
          Retry
        </Button>
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
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search bookmarks..."
            value={searchQuery}
          />
        </div>
        <div className="relative w-full sm:w-48">
          <Tag className="absolute top-3 left-3 h-4 w-4 text-biolum-faint" />
          <Input
            className="pl-9"
            onInput={(event) => setFilterTag(event.currentTarget.value)}
            placeholder="Filter by tag"
            value={filterTag}
          />
        </div>
      </div>
      <p className="text-biolum-faint text-xs">
        Search and tag filters apply to the currently loaded page.
      </p>

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
function BookRoute() {
  return (
    <PaneLayout
      createForm={<BookmarkCreateForm />}
      description="Save and organize web resources, articles, and research links"
      paneComponent={<BookPane />}
      title="Bookmarks"
    />
  );
}
