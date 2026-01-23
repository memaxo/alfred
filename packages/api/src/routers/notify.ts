import { observable } from "@trpc/server/observable";
import { z } from "zod";
import type { NotifyEvent } from "../services/notify";
import {
  notifyStatus,
  publishPing,
  subscribeToNotify,
} from "../services/notify";
import { authedProcedure, rateLimit, router } from "../trpc";

export const notifyRouter = router({
  status: authedProcedure.use(rateLimit).query(({ ctx }) => {
    const userId = ctx.session.user.id;
    return notifyStatus(userId);
  }),

  ping: authedProcedure
    .use(rateLimit)
    .input(z.object({ message: z.string().min(1).max(200) }))
    .mutation(({ ctx, input }) => {
      const userId = ctx.session.user.id;
      publishPing(userId, input.message);
      return { ok: true };
    }),

  subscribe: authedProcedure.subscription(({ ctx }) =>
    observable<NotifyEvent>((emit) => {
      const userId = ctx.session.user.id;
      const unsubscribe = subscribeToNotify(userId, (event) => {
        emit.next(event);
      });
      return () => {
        unsubscribe();
      };
    })
  ),
});
