import {
  createNote,
  deleteNote,
  getNote,
  getNotes,
  updateNote,
} from "@alfred/db/repo/assistant";
import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// Constants
const MAX_NOTE_TITLE_LENGTH = 256;
const MAX_TAGS_COUNT = 32;
const DEFAULT_NOTE_LIST_LIMIT = 100;
const MAX_NOTE_LIST_LIMIT = 200;

const noteMutationInput = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(MAX_NOTE_TITLE_LENGTH).optional(),
  content: z.string().min(1),
  tags: z.array(z.string().min(1)).max(MAX_TAGS_COUNT).optional(),
});

const noteListInput = z.object({
  projectId: z.string().uuid().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_NOTE_LIST_LIMIT)
    .default(DEFAULT_NOTE_LIST_LIMIT),
  offset: z.number().int().min(0).default(0),
});

const noteUpdateInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(MAX_NOTE_TITLE_LENGTH).optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).max(MAX_TAGS_COUNT).optional(),
  })
  .refine((value) => Boolean(value.title ?? value.content ?? value.tags), {
    message: "Provide at least one field to update.",
    path: ["title"],
  });

export const noteRouter = router({
  create: authedProcedure
    .input(noteMutationInput)
    .mutation(async ({ ctx, input }) => {
      // Create note
      const note = await createNote(
        ctx.session.user.id,
        input.content,
        input.title,
        input.tags,
        input.projectId
      );

      if (!note) {
        throw new Error("Failed to create note");
      }

      const mirrorLabel =
        typeof note.title === "string" && note.title.trim().length > 0
          ? note.title
          : input.content.trim().slice(0, 80);

      await ensureMirrorNodes(
        "user",
        [
          {
            kind: "note",
            id: note.id,
            label: mirrorLabel,
            properties: {
              entity: { kind: "note", id: note.id },
              title: note.title,
              updatedAt:
                note.updated instanceof Date
                  ? note.updated.toISOString()
                  : null,
            },
          },
        ],
        { projectId: input.projectId }
      );

      // Fire-and-forget RAG embedding (non-blocking)
      // Skip embedding if content is empty or whitespace only
      const trimmedContent = input.content.trim();
      if (trimmedContent.length > 0) {
        void (async () => {
          try {
            const { ingest } = await import("@alfred/rag");
            await ingest(`note:${note.id}`, trimmedContent);
          } catch (error) {
            logger.warn("note_embedding_failed", {
              noteId: note.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      }

      return note;
    }),

  list: authedProcedure
    .input(noteListInput)
    .query(({ ctx, input }) =>
      getNotes(ctx.session.user.id, input.limit, input.offset, input.projectId)
    ),

  get: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const note = await getNote(ctx.session.user.id, input.id);
      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "note_not_found",
        });
      }
      return note;
    }),

  update: authedProcedure.input(noteUpdateInput).mutation(async ({ input }) => {
    const updated = await updateNote(input.id, {
      title: input.title,
      content: input.content,
      tags: input.tags,
    });

    await ensureMirrorNodes("user", [
      {
        kind: "note",
        id: input.id,
        label: input.title,
      },
    ]);

    // Re-embed if content changed (fire-and-forget)
    // Skip embedding if content is empty or whitespace only
    if (input.content) {
      const trimmedContent = input.content.trim();
      if (trimmedContent.length > 0) {
        void (async () => {
          try {
            const { ingest } = await import("@alfred/rag");
            await ingest(`note:${input.id}`, trimmedContent);
          } catch (error) {
            logger.warn("note_reembedding_failed", {
              noteId: input.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      }
    }

    return { updated };
  }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await deleteNote(input.id);
      return { deleted };
    }),
});
