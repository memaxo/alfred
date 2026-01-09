import { userRepo, type userSchema } from "@alfred/db";
import * as conversationRepo from "@alfred/db/repo/conversation";

type PreferenceRow = typeof userSchema.preferences.$inferSelect;

import { recordMemoryForget, recordMemoryUpdate } from "@alfred/agent/metrics";
import {
  preferenceDeleteSchema,
  preferenceListSchema,
  preferenceSetSchema,
} from "@alfred/type";
import {
  preferenceKeySchema,
  preferenceValueSchema,
} from "@alfred/type/preference";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { PolicyObligationError } from "../errors";
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

function ensureObligations(ctx: Context) {
  const obligations = ctx.policy?.obligations ?? [];
  if (obligations.length > 0) {
    throw new PolicyObligationError("preference.write", obligations, {
      reason: "preference_write",
    });
  }
}

async function ensureMessageOwnership(options: {
  userId: string;
  messageId: string;
}) {
  const message = await conversationRepo.getMessage(
    options.messageId,
    options.userId
  );
  if (!message) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "message_not_found",
    });
  }
  return message;
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

  updateFromFeedback: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        messageId: z.string().min(1),
        conversationId: z.string().min(1).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string().min(1)).optional(),
        preferenceUpdates: z
          .record(z.string(), z.unknown())
          .refine(
            (value) => Object.keys(value).length > 0,
            "preferenceUpdates must include at least one entry"
          )
          .superRefine((value, ctx) => {
            for (const key of Object.keys(value)) {
              const parsed = preferenceKeySchema.safeParse(key);
              if (!parsed.success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "invalid preference key",
                  path: [key],
                });
              }
              const valueResult = preferenceValueSchema.safeParse(value[key]);
              if (!valueResult.success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    valueResult.error.issues[0]?.message ??
                    "invalid preference value",
                  path: [key],
                });
              }
            }
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const ownedMessage = await ensureMessageOwnership({
        userId: session.user.id,
        messageId: input.messageId,
      });

      let updated = 0;
      for (const [key, value] of Object.entries(input.preferenceUpdates)) {
        await userRepo.setPreference(
          session.user.id,
          key,
          value,
          0.9,
          "learned",
          input.projectId
        );
        updated += 1;
      }

      if (updated > 0) {
        const { invalidatePreferenceCache } = await import(
          "@alfred/agent/preference/loader"
        );
        await invalidatePreferenceCache(session.user.id);
        recordMemoryUpdate("preference", "learned");
      }

      if (input.rating || (input.tags && input.tags.length > 0)) {
        await userRepo.addFeedback(
          session.user.id,
          input.conversationId ?? ownedMessage.conversationId ?? "",
          input.messageId,
          input.rating,
          undefined,
          input.tags,
          input.projectId
        );
      }

      return { updated };
    }),

  inferFromCorrection: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        originalMessageId: z.string().min(1),
        correctedMessageId: z.string().min(1),
        correctionType: z.enum(["verbosity", "tone", "format", "content"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const [original, corrected] = await Promise.all([
        ensureMessageOwnership({
          userId: session.user.id,
          messageId: input.originalMessageId,
        }),
        ensureMessageOwnership({
          userId: session.user.id,
          messageId: input.correctedMessageId,
        }),
      ]);

      const { inferPreferenceFromCorrection } = await import(
        "@alfred/agent/preference/inference"
      );
      const inferred = await inferPreferenceFromCorrection(
        conversationRepo.messageRowToUIMessage(original),
        conversationRepo.messageRowToUIMessage(corrected),
        input.correctionType
      );

      if (!inferred) {
        return { inferred: 0 };
      }

      await userRepo.setPreference(
        session.user.id,
        inferred.key,
        inferred.value,
        0.7,
        "inferred",
        input.projectId
      );
      {
        const { invalidatePreferenceCache } = await import(
          "@alfred/agent/preference/loader"
        );
        await invalidatePreferenceCache(session.user.id);
      }
      recordMemoryUpdate("preference", "inferred");

      return { inferred: 1 };
    }),

  /**
   * Correct a domain classification.
   * Creates a high-confidence learned association in the knowledge graph.
   */
  correctClassification: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(
      z.object({
        text: z.string().min(1).max(1000),
        correctDomain: z.string().min(1).max(100),
        incorrectDomain: z.string().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      {
        const { learnDomainCorrection } = await import(
          "@alfred/agent/orchestrator/learning-worker"
        );
        await learnDomainCorrection(
          input.text,
          input.correctDomain,
          input.incorrectDomain
        );
      }

      recordMemoryUpdate("classification", "correction");

      return { success: true };
    }),
});
