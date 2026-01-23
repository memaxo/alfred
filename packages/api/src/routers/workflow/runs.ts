import * as workflowRepo from "@alfred/db/repo/workflow";
import { z } from "zod";
import { authedProcedure } from "../../trpc";

export const workflowEventsProcedure = authedProcedure
  .input(z.object({ runId: z.string().min(1) }))
  .query(async ({ input }) => {
    const events = await workflowRepo.listEvents(input.runId);
    return events;
  });

export const workflowListRunsProcedure = authedProcedure
  .input(
    z.object({
      status: z
        .enum(["running", "suspended", "completed", "failed", "cancelled"])
        .optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const runs = await workflowRepo.listRuns({
      userId: ctx.session.user.id,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    });
    return runs;
  });
