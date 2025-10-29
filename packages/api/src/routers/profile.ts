import { userRepo } from "@alfred/db";
import { recordMemoryUpdate } from "@alfred/agent";
import { profileUpdateSchema } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { authedProcedure, router } from "../index";
import { requirePolicy } from "../gate";

function mapProfileResource(_input: unknown, ctx: { session: { user?: { id?: string } } | null }) {
  const userId = ctx.session?.user?.id ?? "anonymous";
  return {
    kind: "user" as const,
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

export const profileRouter = router({
  get: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
    }

    return userRepo.getProfile(session.user.id);
  }),

  update: authedProcedure
    .use(requirePolicy("profile.write", (input, ctx) => mapProfileResource(input, ctx)))
    .input(profileUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }

      ensureObligations(ctx);

      const profile = await userRepo.upsertProfile(session.user.id, {
        name: input.name ?? undefined,
        email: input.email ?? undefined,
        avatar: input.avatar ?? undefined,
        timezone: input.timezone ?? undefined,
      });

      recordMemoryUpdate("profile", input.source ?? "user");
      return profile;
    }),
});
