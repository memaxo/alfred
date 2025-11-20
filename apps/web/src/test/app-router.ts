import { mock } from "bun:test";
import { z } from "zod";
import {
  router,
  publicProcedure,
  authedProcedure,
} from "../../../../packages/api/src/trpc";
import { noteRouter } from "../../../../packages/api/src/routers/note";
import { remindRouter } from "../../../../packages/api/src/routers/remind";
import { tokenRouter } from "../../../../packages/api/src/routers/token";
import { profileRouter } from "../../../../packages/api/src/routers/profile";
import * as workflowRepo from "../../../../packages/db/src/repo/workflow";

mock.module("@alfred/rag", () => ({
  ingest: async () => undefined,
}));

const workflowStatusEnum = z.enum([
  "running",
  "suspended",
  "completed",
  "failed",
  "cancelled",
]);

const workflowTestRouter = router({
  listRuns: authedProcedure
    .input(
      z.object({
        status: workflowStatusEnum.optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(({ ctx, input }) =>
      workflowRepo.listRuns({
        userId: ctx.session.user.id,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      })
    ),
  events: authedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(({ input }) => workflowRepo.listEvents(input.runId)),
});

/**
 * Minimal app router used by UI tests. It wires only the procedures that the
 * current suites rely on so we can avoid importing in-progress routers that
 * may fail to compile during development.
 */
export const uiTestAppRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  note: noteRouter,
  remind: remindRouter,
  token: tokenRouter,
  profile: profileRouter,
  workflow: workflowTestRouter,
});

export type UiTestAppRouter = typeof uiTestAppRouter;
