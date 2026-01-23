import { attentionRepo } from "@alfred/db";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { resolveAttentionItem } from "../services/attention";
import type { NotifyEvent } from "../services/notify";
import { subscribeToNotify } from "../services/notify";
import { authedProcedure, rateLimit, router } from "../trpc";
import { assertResourceAccess } from "../utils/error-helpers";

const attentionStatusSchema = z.enum(["open", "acknowledged", "resolved"]);
const attentionUrgencySchema = z.enum(["low", "normal", "high", "critical"]);

export const attentionRouter = router({
  list: authedProcedure
    .use(rateLimit)
    .input(
      z
        .object({
          kind: z.string().min(1).max(200).optional(),
          status: attentionStatusSchema.optional(),
          urgency: attentionUrgencySchema.optional(),
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
      return attentionRepo.listAttentionItems({
        userId,
        kind: input?.kind,
        status: input?.status,
        urgency: input?.urgency,
        focusSetId: input?.focusSetId,
        commitmentId: input?.commitmentId,
        workflowRunId: input?.workflowRunId,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  resolve: authedProcedure
    .use(rateLimit)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await attentionRepo.getAttentionItemById(input.id);
      assertResourceAccess(existing, userId, "attention");

      await resolveAttentionItem({ userId, id: input.id });
      return { ok: true };
    }),

  subscribe: authedProcedure.subscription(({ ctx }) =>
    observable<Extract<NotifyEvent, { type: "attention" }>>((emit) => {
      const userId = ctx.session.user.id;
      const unsubscribe = subscribeToNotify(userId, (event) => {
        if (event.type !== "attention") {
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
