import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
} from "@alfred/db/repo/assistant";
import { logger } from "@alfred/logger";
import { ingest } from "@alfred/rag";
import z from "zod";
import { authedProcedure, router } from "../trpc";

// Constants
const MAX_NOTE_TITLE_LENGTH = 256;
const MAX_TAGS_COUNT = 32;
const DEFAULT_NOTE_LIST_LIMIT = 100;
const MAX_NOTE_LIST_LIMIT = 200;

const noteMutationInput = z.object({
  title: z.string().min(1).max(MAX_NOTE_TITLE_LENGTH).optional(),
  content: z.string().min(1),
  tags: z.array(z.string().min(1)).max(MAX_TAGS_COUNT).optional(),
});

const noteListInput = z.object({
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
        input.tags
      );

      if (!note) {
        throw new Error("Failed to create note");
      }

      // Fire-and-forget RAG embedding (non-blocking)
      // Skip embedding if content is empty or whitespace only
      const trimmedContent = input.content.trim();
      if (trimmedContent.length > 0) {
        ingest(`note:${note.id}`, trimmedContent).catch((error) => {
          logger.warn("note_embedding_failed", {
            noteId: note.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      return note;
    }),

  list: authedProcedure
    .input(noteListInput)
    .query(({ ctx, input }) =>
      getNotes(ctx.session.user.id, input.limit, input.offset)
    ),

  update: authedProcedure.input(noteUpdateInput).mutation(async ({ input }) => {
    const updated = await updateNote(input.id, {
      title: input.title,
      content: input.content,
      tags: input.tags,
    });

    // Re-embed if content changed (fire-and-forget)
    // Skip embedding if content is empty or whitespace only
    if (input.content) {
      const trimmedContent = input.content.trim();
      if (trimmedContent.length > 0) {
        ingest(`note:${input.id}`, trimmedContent).catch((error) => {
          logger.warn("note_reembedding_failed", {
            noteId: input.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
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
