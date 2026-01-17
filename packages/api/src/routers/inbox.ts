import type { InboxRow } from "@alfred/db/repo/sense";
import { listInbox } from "@alfred/db/repo/sense";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

export type InboxEvent =
  | { type: "inbox.updated"; payload: { item: InboxRow } }
  | { type: "inbox.deleted"; payload: { captureId: string } };

const listeners = new Map<string, Set<(event: InboxEvent) => void>>();

export function publishInboxEvent(userId: string, event: InboxEvent): void {
  const set = listeners.get(userId);
  if (!set || set.size === 0) {
    return;
  }
  for (const cb of set) {
    cb(event);
  }
}

const inboxListInput = z.object({
  status: z.enum(["new", "triaged", "converted", "archived"]).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const inboxRouter = router({
  list: authedProcedure.input(inboxListInput).query(async ({ ctx, input }) => {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    return listInbox({
      userId: session.user.id,
      limit: input.limit,
      status: input.status,
    });
  }),

  subscribe: authedProcedure.subscription(({ ctx }) =>
    observable<InboxEvent>((emit) => {
      const session = ctx.session;
      if (!session) {
        emit.error(
          new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
        );
        return () => {};
      }

      const userId = session.user.id;
      const set =
        listeners.get(userId) ?? new Set<(event: InboxEvent) => void>();
      if (!listeners.has(userId)) {
        listeners.set(userId, set);
      }

      const cb = (event: InboxEvent) => emit.next(event);
      set.add(cb);

      return () => {
        set.delete(cb);
        if (set.size === 0) {
          listeners.delete(userId);
        }
      };
    })
  ),
});
