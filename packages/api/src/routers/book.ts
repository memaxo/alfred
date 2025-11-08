import * as assistantRepo from "@alfred/db/repo/assistant";
import z from "zod";
import { authedProcedure, router } from "../trpc";

const bookmarkInput = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(1024).optional(),
  tags: z.array(z.string().min(1)).max(32).optional(),
});

const bookmarkListInput = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

export const bookRouter = router({
  create: authedProcedure.input(bookmarkInput).mutation(({ ctx, input }) =>
    assistantRepo.createBookmark(
      ctx.session.user.id,
      input.url,
      input.title,
      input.description,
      input.tags
    )
  ),

  list: authedProcedure.input(bookmarkListInput).query(({ ctx, input }) =>
    assistantRepo.getBookmarks(ctx.session.user.id, input.limit, input.offset)
  ),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await assistantRepo.deleteBookmark(input.id);
      return { deleted };
    }),
});
