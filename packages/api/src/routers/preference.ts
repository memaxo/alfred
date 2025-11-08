import { userRepo, type userSchema } from "@alfred/db";

type PreferenceRow = typeof userSchema.preferences.$inferSelect;

import { recordMemoryForget, recordMemoryUpdate } from "@alfred/agent";
import {
  preferenceDeleteSchema,
  preferenceListSchema,
  preferenceSetSchema,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

function mapPreferenceResource(
  _input: unknown,
  ctx: { session: { user?: { id?: string } } | null }
) {
  const userId = ctx.session?.user?.id ?? "anonymous";
  return {
    kind: "preference" as const,
    id: userId,
  };
}

function ensureObligations(ctx: { policy?: { obligations: string[] } }) {
  if (ctx.policy?.obligations?.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "policy_obligation_unfulfilled",
      cause: ctx.policy.obligations,
    });
  }
}

export const preferenceRouter = router({
  list: authedProcedure
    .input(preferenceListSchema.optional())
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = preferenceListSchema.parse(input ?? {});
      const preferences = await userRepo.getPreferences(session.user.id);
      const list = Array.isArray(preferences)
        ? (preferences as PreferenceRow[])
        : [];
      return list.slice(params.offset, params.offset + params.limit);
    }),

  set: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(preferenceSetSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const preference = await userRepo.setPreference(
        session.user.id,
        input.key,
        input.value,
        input.confidence ?? 1.0,
        input.source ?? "user"
      );

      recordMemoryUpdate("preference", input.source ?? "user");
      return preference as unknown as PreferenceRow;
    }),

  delete: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(preferenceDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const removed =
        Number(await userRepo.deletePreference(session.user.id, input.key)) ||
        0;
      if (removed > 0) {
        recordMemoryForget("preference");
      }

      return { removed };
    }),
});
