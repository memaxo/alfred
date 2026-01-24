import * as assistantRepo from "@alfred/db/repo/assistant";
import z from "zod";

import { authedProcedure, router } from "../trpc";

export const timerRouter = router({
  create: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        duration: z.number().int().positive(),
        label: z.string().min(1).max(128).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      assistantRepo.createTimer(
        ctx.session.user.id,
        input.duration,
        input.label,
        input.projectId
      )
    ),

  active: authedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(({ ctx, input }) =>
      assistantRepo.getActiveTimers(ctx.session.user.id, input?.projectId)
    ),

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
