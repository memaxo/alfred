import { getWorkingSet, setWorkingSet } from "@alfred/db/repo/sense";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc";

const itemSchema = z.object({
  kind: z.enum(["project", "conversation", "note", "reminder", "task"]),
  id: z.string().min(1),
  label: z.string().min(1).max(256).optional(),
});

const setInput = z.object({
  items: z.array(itemSchema).max(20),
  focus: itemSchema.optional(),
});

export const workingsetRouter = router({
  get: authedProcedure.query(({ ctx }) => {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    return getWorkingSet(session.user.id);
  }),

  set: authedProcedure.input(setInput).mutation(({ ctx, input }) => {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    return setWorkingSet({
      userId: session.user.id,
      items: input.items,
      focus: input.focus,
    });
  }),
});
