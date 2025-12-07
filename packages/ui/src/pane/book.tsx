import type { ReactNode } from "react";

export type BookmarkPaneItem = {
  id: string;
  title: string | null;
  url: string;
  tags: string[] | null;
  createdAt: string | null;
};

export type BookmarkPaneProps = {
  items: BookmarkPaneItem[];
  onDelete: (id: string) => void;
  className?: string;
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function BookmarkPane({
  items,
  onDelete,
  className,
}: BookmarkPaneProps): ReactNode {
  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="py-8 text-center text-biolum-dim">
          No bookmarks yet. Add one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}
    >
      {items.map((bookmark) => (
        <div
          className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl"
          key={bookmark.id}
        >
          {/* Title */}
          <div className="flex-1">
            <h3 className="line-clamp-2 font-medium text-base text-biolum tracking-tighter">
              {bookmark.title || "Untitled Bookmark"}
            </h3>
            <a
              className="text-biolum-dim text-sm underline decoration-white/20 transition-colors hover:text-biolum hover:decoration-white/40"
              href={bookmark.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {extractDomain(bookmark.url)}
            </a>
          </div>

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bookmark.tags.map((tag: string, idx: number) => (
                <span
                  className="rounded-full border border-white/10 bg-biolum/10 px-2 py-1 text-biolum-dim text-xs"
                  key={idx}
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Created Date */}
          {bookmark.createdAt && (
            <p className="text-biolum-faint text-xs">
              {new Date(bookmark.createdAt).toLocaleDateString()}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 border-white/10 border-t pt-2">
            <a
              className="flex-1 rounded-full bg-biolum/10 px-3 py-1.5 text-center text-biolum text-sm transition-colors hover:bg-biolum/20"
              href={bookmark.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open
            </a>
            <button
              className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-red-400 text-sm transition-colors hover:bg-red-500/30"
              onClick={() => onDelete(bookmark.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
