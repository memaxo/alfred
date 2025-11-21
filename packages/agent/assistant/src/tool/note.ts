import { assistantRepo } from "@alfred/db";
import { z } from "zod";
import { recordAssistantToolCall } from "../../../src/metrics";

const { createNote, deleteNote, getNotes, updateNote } = assistantRepo;

const noteInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["create", "list", "update", "delete"]),
  id: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

type NoteInput = z.infer<typeof noteInputSchema>;

function mapNote(row: Awaited<ReturnType<typeof createNote>>) {
  if (!row) {
    return null;
  }
  const tags = Array.isArray((row as { tags?: unknown }).tags)
    ? ((row as { tags?: unknown }).tags as string[])
    : [];

  return {
    id: (row as { id: string }).id,
    title: (row as { title?: string | null }).title ?? null,
    content: (row as { content: string }).content,
    tags,
    createdAt:
      ((row as { created?: Date | null }).created ?? null)?.toISOString?.() ??
      null,
    updatedAt:
      ((row as { updated?: Date | null }).updated ?? null)?.toISOString?.() ??
      null,
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

export const toolNote = {
  name: "note",
  description: "Manage assistant notes (create, list, update, delete).",
  inputSchema: noteInputSchema,
  outputSchema: z.object({
    ok: z.boolean().optional(),
    note: z
      .object({
        id: z.string(),
        title: z.string().nullable(),
        content: z.string(),
        tags: z.array(z.string()),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })
      .optional(),
    notes: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().nullable(),
          content: z.string(),
          tags: z.array(z.string()),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
        })
      )
      .optional(),
  }),
  execute: async ({ input }: { input: NoteInput }) => {
    recordAssistantToolCall("note");

    switch (input.action) {
      case "create": {
        const content = ensure(input.content, "note_content_required");
        const created = await createNote(
          input.userId,
          content,
          input.title ?? undefined,
          input.tags
        );
        return {
          ok: true,
          note: mapNote(created),
        };
      }
      case "list": {
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const rows = await getNotes(input.userId, limit, offset);
        return {
          notes: rows.map((row) => mapNote(row)).filter(Boolean) as any[],
        };
      }
      case "update": {
        const id = ensure(input.id, "note_id_required");
        const updates: Parameters<typeof updateNote>[1] = {};
        if (input.title !== undefined) {
          updates.title = input.title;
        }
        if (input.content !== undefined) {
          updates.content = input.content;
        }
        if (input.tags !== undefined) {
          updates.tags = input.tags;
        }
        const count = await updateNote(id, updates);
        return {
          ok: count > 0,
        };
      }
      case "delete": {
        const id = ensure(input.id, "note_id_required");
        const count = await deleteNote(id);
        return {
          ok: count > 0,
        };
      }
      default:
        throw new Error("note_action_not_supported");
    }
  },
};

export type ToolNote = typeof toolNote;
