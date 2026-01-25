import { recordMemoryForget } from "@alfred/agent/metrics";
import {
  deleteEventsForUser,
  deleteFact,
  deleteFactsForUser,
  getEvents,
  listFacts,
  searchFacts,
} from "@alfred/db/repo/user";
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
  purge: authedProcedure
    .use(
      requirePolicy("privacy.purge", (input, ctx) =>
        mapPrivacyResource(input, ctx)
      )
    )
    .mutation(async ({ ctx }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const removedFacts = await deleteFactsForUser(session.user.id);
      const removedEvents = await deleteEventsForUser(session.user.id);
      if (removedFacts > 0 || removedEvents > 0) {
        recordMemoryForget("purge");
      }

      return { removedFacts, removedEvents };
    }),

  facts: authedProcedure
    .input(privacyFactQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = privacyFactQuerySchema.parse(input ?? {});
      if (params.embedding) {
        const matches = params.projectId
          ? await searchFacts(
              session.user.id,
              params.embedding,
              params.limit,
              params.threshold,
              params.projectId
            )
          : await searchFacts(
              session.user.id,
              params.embedding,
              params.limit,
              params.threshold
            );
        return Array.isArray(matches) ? matches : [];
      }

      const listed = params.projectId
        ? await listFacts(
            session.user.id,
            params.limit,
            params.offset,
            params.projectId
          )
        : await listFacts(session.user.id, params.limit, params.offset);
      return Array.isArray(listed) ? listed : [];
    }),

  deleteFact: authedProcedure
    .use(
      requirePolicy("privacy.purge", (input, ctx) =>
        mapPrivacyResource(input, ctx)
      )
    )
    .input(privacyFactDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const removed = Number(await deleteFact(input.id)) || 0;
      if (removed > 0) {
        recordMemoryForget(input.scope ?? "fact");
      }

      return { removed };
    }),

  events: authedProcedure
    .input(privacyEventsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = privacyEventsQuerySchema.parse(input ?? {});
      const events = params.projectId
        ? await getEvents(
            session.user.id,
            params.type,
            params.limit,
            params.offset,
            params.projectId
          )
        : await getEvents(
            session.user.id,
            params.type,
            params.limit,
            params.offset
          );
      return Array.isArray(events) ? events : [];
    }),
});
