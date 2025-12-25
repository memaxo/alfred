import { recordMemoryForget } from "@alfred/agent";
import { userRepo } from "@alfred/db";
import {
  privacyEventsQuerySchema,
  privacyFactDeleteSchema,
  privacyFactQuerySchema,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import type { Context } from "../context";
import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

function mapPrivacyResource(
  _input: unknown,
  ctx: { session: { user?: { id?: string } } | null }
) {
  const userId = ctx.session?.user?.id ?? "anonymous";
  return {
    kind: "privacy" as const,
    id: userId,
  };
}

function ensureObligations(ctx: Context) {
  const obligations = ctx.policy?.obligations ?? [];
  if (obligations.length > 0) {
    throw new PolicyObligationError("privacy.purge", obligations, {
      reason: "privacy_purge",
    });
  }
}

export const privacyRouter = router({
  facts: authedProcedure
    .input(privacyFactQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = privacyFactQuerySchema.parse(input ?? {});
      if (params.embedding) {
        const matches = await userRepo.searchFacts(
          session.user.id,
          params.embedding,
          params.limit,
          params.threshold
        );
        return Array.isArray(matches) ? matches : [];
      }

      const repo = userRepo as unknown as {
        listFacts?: (
          userId: string,
          limit?: number,
          offset?: number
        ) => Promise<unknown>;
      };
      const listed = repo.listFacts
        ? await repo.listFacts(session.user.id, params.limit, params.offset)
        : [];
      return Array.isArray(listed) ? listed : [];
    }),

  deleteFact: authedProcedure
    .use(
      requirePolicy(
        "privacy.purge",
        (input, ctx) => mapPrivacyResource(input, ctx),
        undefined,
        { handleObligations: "passThrough" }
      )
    )
    .input(privacyFactDeleteSchema)
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
        Number(await userRepo.deleteFact(session.user.id, input.id)) || 0;
      if (removed > 0) {
        recordMemoryForget(input.scope ?? "fact");
      }

      return { removed };
    }),

  events: authedProcedure
    .input(privacyEventsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = privacyEventsQuerySchema.parse(input ?? {});
      const events = await userRepo.getEvents(
        session.user.id,
        params.type,
        params.limit,
        params.offset
      );
      return Array.isArray(events) ? events : [];
    }),
});
