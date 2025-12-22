import type { NodeProps } from "@xyflow/react";
import { BookMarked, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMindscapeStore } from "@/store/mindscape";
import { bookmarkNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "@/lib/mindscape/lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

const BOOKMARK_LIST_KEY = { limit: 50, offset: 0 } as const;

export function BookmarkNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const parsed = bookmarkNodeDataSchema.safeParse(data);
  const bookmarkData = parsed.success ? parsed.data : { lastTags: undefined };
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState(bookmarkData.lastTags?.join(", ") ?? "");

  useEffect(() => {
    setTags(bookmarkData.lastTags?.join(", ") ?? "");
  }, [bookmarkData.lastTags]);

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const utils = trpc.useUtils();
  const bookmarksQuery = trpc.book.list.useQuery(BOOKMARK_LIST_KEY);
  const bookmarks = bookmarksQuery.data ?? [];

  const createBookmark = trpc.book.create.useMutation({
    onSuccess: async () => {
      toast.success("Bookmark saved");
      updateArtifactData(id, {
        lastTags: parseTags(tags),
      });
      setTitle("");
      setUrl("");
      await utils.book.list.invalidate(BOOKMARK_LIST_KEY);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to add bookmark");
    },
  });

  const deleteBookmark = trpc.book.delete.useMutation({
    onSuccess: async () => {
      toast.success("Bookmark deleted");
      await utils.book.list.invalidate(BOOKMARK_LIST_KEY);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete bookmark");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      toast.error("URL is required");
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      toast.error("Enter a valid URL");
      return;
    }

    createBookmark.mutate({
      title: title.trim() || undefined,
      url: url.trim(),
      tags: parseTags(tags),
    });
  };

  const bookmarkCards = useMemo(
    () =>
      bookmarks.map((bookmark) => ({
        id: bookmark.id,
        title: bookmark.title || bookmark.url,
        url: bookmark.url,
        tags: bookmark.tags ?? [],
        createdAt: bookmark.createdAt
          ? new Date(bookmark.createdAt).toLocaleString()
          : null,
      })),
    [bookmarks]
  );

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-cyan-500" shadow="shadow-cyan-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-cyan-500/20"
        hoverColor="hover:border-cyan-500/40"
        icon={<BookMarked className="h-3 w-3" />}
        label="Bookmarks"
        textColor="text-cyan-500"
      />
    );
  }

  return (
    <MindscapeNode
      className="w-[360px] border-cyan-500/20 bg-cyan-950/10"
      headerActions={<BookMarked className="h-4 w-4 text-cyan-300" />}
      id={id}
      selected={selected}
      title="Bookmarks"
    >
      <div className="flex flex-col gap-3 p-4">
        <form className="space-y-2" onSubmit={handleSubmit}>
          <Input
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={url}
          />
          <Input
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional)"
            value={title}
          />
          <Input
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags (comma separated)"
            value={tags}
          />
          <Button
            className="w-full"
            disabled={createBookmark.isPending}
            type="submit"
          >
            {createBookmark.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </span>
            ) : (
              "Add Bookmark"
            )}
          </Button>
        </form>

        <ScrollArea className="h-[220px] rounded-md border border-white/10 p-2">
          {bookmarksQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-biolum-faint text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : bookmarkCards.length === 0 ? (
            <p className="py-4 text-center text-biolum-faint text-sm">
              Save links to see them here.
            </p>
          ) : (
            <ul className="space-y-3">
              {bookmarkCards.map((bookmark) => (
                <li
                  className="rounded-md border border-white/10 bg-white/5 p-3"
                  key={bookmark.id}
                >
                  <div className="flex items-center justify-between font-medium text-sm">
                    <a
                      className="text-cyan-200 hover:underline"
                      href={bookmark.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {bookmark.title}
                    </a>
                    <Button
                      aria-label="Delete bookmark"
                      onClick={() => deleteBookmark.mutate({ id: bookmark.id })}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-cyan-200" />
                    </Button>
                  </div>
                  <p className="truncate text-biolum-faint text-xs">
                    {bookmark.url}
                  </p>
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {bookmark.tags.map((tag: string) => (
                        <span
                          className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200 uppercase tracking-wide"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {bookmark.createdAt && (
                    <p className="mt-2 text-[10px] text-biolum-faint">
                      Saved {bookmark.createdAt}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </MindscapeNode>
  );
}

function parseTags(tags: string): string[] | undefined {
  if (!tags.trim()) {
    return;
  }
  const parts = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return parts.length > 0 ? parts : undefined;
}
