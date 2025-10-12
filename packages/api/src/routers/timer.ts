import * as assistantRepo from "@alfred/db/repo/assistant";
import z from "zod";
import { authedProcedure, router } from "../index";

export const timerRouter = router({
  create: authedProcedure
    .input(
      z.object({
        duration: z.number().int().positive(),
        label: z.string().min(1).max(128).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      assistantRepo.createTimer(ctx.session.user.id, input.duration, input.label)
    ),

  active: authedProcedure.query(({ ctx }) => assistantRepo.getActiveTimers(ctx.session.user.id)),

  done: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const updated = await assistantRepo.markTimerCompleted(input.id);
      return { updated };
    }),

  cancel: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const updated = await assistantRepo.cancelTimer(input.id);
      return { updated };
    }),
});
