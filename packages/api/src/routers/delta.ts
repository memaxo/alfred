import { deltaRepo } from "@alfred/db";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

import type { NotifyEvent } from "../services/notify";

import { subscribeToNotify } from "../services/notify";
import { authedProcedure, rateLimit, router } from "../trpc";

const deltaScopeSchema = z.enum(["focus_set", "commitment", "workflow_run"]);

export const deltaRouter = router({
  list: authedProcedure
    .use(rateLimit)
    .input(
      z
        .object({
          scope: deltaScopeSchema.optional(),
          focusSetId: z.string().uuid().optional(),
          commitmentId: z.string().uuid().optional(),
          workflowRunId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return deltaRepo.listDeltaBriefs({
        userId,
        scope: input?.scope,
        focusSetId: input?.focusSetId,
        commitmentId: input?.commitmentId,
        workflowRunId: input?.workflowRunId,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  subscribe: authedProcedure.subscription(({ ctx }) =>
    observable<Extract<NotifyEvent, { type: "delta" }>>((emit) => {
      const userId = ctx.session.user.id;
      const unsubscribe = subscribeToNotify(userId, (event) => {
        if (event.type !== "delta") {
          return;
        }
        emit.next(event);
      });
      return () => {
        unsubscribe();
      };
    })
  ),
});
