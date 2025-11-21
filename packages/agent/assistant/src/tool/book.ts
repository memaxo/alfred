import { assistantRepo } from "@alfred/db";
import { z } from "zod";
import { recordAssistantToolCall } from "../../../src/metrics";

const { createBookmark, deleteBookmark, getBookmarks } = assistantRepo;

const bookmarkInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["create", "list", "delete"]),
  id: z.string().optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

type BookmarkInput = z.infer<typeof bookmarkInputSchema>;

function toISOString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapBookmark(row: Awaited<ReturnType<typeof createBookmark>>) {
  if (!row) {
    return null;
  }
  const tags = Array.isArray((row as { tags?: unknown }).tags)
    ? ((row as { tags?: unknown }).tags as string[])
    : [];

  return {
    id: (row as { id: string }).id,
    url: (row as { url: string }).url,
    title: (row as { title?: string | null }).title ?? null,
    description: (row as { description?: string | null }).description ?? null,
    tags,
    createdAt: toISOString((row as { created?: Date | null }).created ?? null),
  };
}

function ensure<T>(value: T | undefined | null, error: string): T {
  if (value === undefined || value === null) {
    throw new Error(error);
  }
  if (typeof value === "string" && value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

export const toolBook = {
  name: "book",
  description: "Manage bookmarks (create, list, delete).",
  inputSchema: bookmarkInputSchema,
  outputSchema: z.object({
    ok: z.boolean().optional(),
    bookmark: z
      .object({
        id: z.string(),
        url: z.string(),
        title: z.string().nullable(),
        description: z.string().nullable(),
        tags: z.array(z.string()),
        createdAt: z.string().nullable(),
      })
      .optional(),
    bookmarks: z
      .array(
        z.object({
          id: z.string(),
          url: z.string(),
          title: z.string().nullable(),
          description: z.string().nullable(),
          tags: z.array(z.string()),
          createdAt: z.string().nullable(),
        })
      )
      .optional(),
  }),
  execute: async ({ input }: { input: BookmarkInput }) => {
    recordAssistantToolCall("book");

    switch (input.action) {
      case "create": {
        const url = ensure(input.url, "bookmark_url_required");
        const created = await createBookmark(
          input.userId,
          url,
          input.title ?? undefined,
          input.description ?? undefined,
          input.tags ?? undefined
        );
        return {
          ok: true,
          bookmark: mapBookmark(created),
        };
      }
      case "list": {
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const rows = await getBookmarks(input.userId, limit, offset);
        return {
          bookmarks: rows
            .map((row) => mapBookmark(row))
            .filter(Boolean) as any[],
        };
      }
      case "delete": {
        const id = ensure(input.id, "bookmark_id_required");
        const count = await deleteBookmark(id);
        return {
          ok: count > 0,
        };
      }
      default:
        throw new Error("bookmark_action_not_supported");
    }
  },
};

export type ToolBook = typeof toolBook;
