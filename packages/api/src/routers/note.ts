import * as assistantRepo from "@alfred/db/repo/assistant";
import z from "zod";
import { authedProcedure, router } from "../index";

const noteMutationInput = z.object({
  title: z.string().min(1).max(256).optional(),
  content: z.string().min(1),
  tags: z.array(z.string().min(1)).max(32).optional(),
});

const noteListInput = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

const noteUpdateInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(256).optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).max(32).optional(),
  })
  .refine(
    value => Boolean(value.title ?? value.content ?? value.tags),
    {
      message: "Provide at least one field to update.",
      path: ["title"],
    }
  );

export const noteRouter = router({
  create: authedProcedure.input(noteMutationInput).mutation(({ ctx, input }) =>
    assistantRepo.createNote(ctx.session.user.id, input.content, input.title, input.tags)
  ),

  list: authedProcedure.input(noteListInput).query(({ ctx, input }) =>
    assistantRepo.getNotes(ctx.session.user.id, input.limit, input.offset)
  ),

  update: authedProcedure.input(noteUpdateInput).mutation(async ({ input }) => {
    const updated = await assistantRepo.updateNote(input.id, {
      title: input.title,
      content: input.content,
      tags: input.tags,
    });
    return { updated };
  }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await assistantRepo.deleteNote(input.id);
      return { deleted };
    }),
});
