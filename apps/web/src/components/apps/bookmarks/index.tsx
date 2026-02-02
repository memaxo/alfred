import { Bookmark, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export function BookmarksApp({ window: _window }: WindowComponentProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: bookmarks, isLoading } = trpc.book.list.useQuery({});

  const createBookmark = trpc.book.create.useMutation({
    onSuccess: () => {
      utils.book.list.invalidate();
      setUrl("");
      setTitle("");
      toast.success("Bookmark saved");
    },
  });

  const deleteBookmark = trpc.book.delete.useMutation({
    onSuccess: () => utils.book.list.invalidate(),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      return;
    }

    createBookmark.mutate({
      url: url.trim(),
      title: title.trim() || undefined,
    });
  };

  const filtered = useMemo(() => {
    if (!bookmarks) {
      return [];
    }
    if (!search.trim()) {
      return bookmarks;
    }
    const q = search.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }, [bookmarks, search]);

  return (
    <div className="flex h-full flex-col bg-void">
      <div className="flex h-10 items-center justify-between border-white/5 border-b bg-void-surface px-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Bookmarks</span>
        </div>
      </div>

      <div className="space-y-3 border-white/5 border-b p-4">
        <form className="space-y-2" onSubmit={handleSave}>
          <Input
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (https://...)"
            required
            type="url"
            value={url}
          />
          <div className="flex gap-2">
            <Input
              className="flex-1"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              value={title}
            />
            <Button disabled={createBookmark.isPending} type="submit">
              <Plus className="mr-1 h-4 w-4" />
              Save
            </Button>
          </div>
        </form>

        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-3.5 w-3.5 text-biolum-dim" />
          <Input
            className="h-8 bg-white/5 pl-8 text-xs"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            value={search}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-3 p-4">
          {isLoading ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Loading bookmarks...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              No bookmarks found
            </div>
          ) : (
            filtered.map((book) => (
              <div
                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20"
                key={book.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-biolum text-sm">
                    {book.title || new URL(book.url).hostname}
                  </div>
                  <div className="truncate text-[10px] text-biolum-dim opacity-60">
                    {book.url}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    asChild
                    className="h-8 w-8 text-biolum-dim hover:text-biolum"
                    size="icon"
                    variant="ghost"
                  >
                    <a href={book.url} rel="noreferrer" target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    className="h-8 w-8 text-red-400 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => deleteBookmark.mutate({ id: book.id })}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BookmarksAppWindow(props: WindowComponentProps) {
  return <BookmarksApp {...props} />;
}

export default BookmarksApp;
