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
        <p className="text-biolum-dim text-center py-8">
          No bookmarks yet. Add one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
      {items.map((bookmark) => (
        <div
          key={bookmark.id}
          className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 flex flex-col gap-3"
        >
          {/* Title */}
          <div className="flex-1">
            <h3 className="text-biolum tracking-tighter text-base font-medium line-clamp-2">
              {bookmark.title || "Untitled Bookmark"}
            </h3>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-biolum-dim text-sm hover:text-biolum transition-colors underline decoration-white/20 hover:decoration-white/40"
            >
              {extractDomain(bookmark.url)}
            </a>
          </div>

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(typeof bookmark.tags === "string" ? bookmark.tags.split(",") : bookmark.tags).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded-full text-xs bg-biolum/10 text-biolum-dim border border-white/10"
                >
                  {typeof tag === "string" ? tag.trim() : tag}
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
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-1.5 rounded-full bg-biolum/10 text-biolum text-sm text-center hover:bg-biolum/20 transition-colors"
            >
              Open
            </a>
            <button
              type="button"
              onClick={() => onDelete(bookmark.id)}
              className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm border border-red-500/30 hover:bg-red-500/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

