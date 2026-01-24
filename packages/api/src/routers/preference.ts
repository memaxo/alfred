import { userRepo, type userSchema } from "@alfred/db";
import * as conversationRepo from "@alfred/db/repo/conversation";

type PreferenceRow = typeof userSchema.preferences.$inferSelect;

import { recordMemoryForget, recordMemoryUpdate } from "@alfred/agent/metrics";
import {
  preferenceDeleteSchema,
  preferenceListSchema,
  preferenceSetSchema,
} from "@alfred/type";
import { isModelRole, type ModelRole, parseModelRef } from "@alfred/type/model";
import {
  preferenceKeySchema,
  preferenceValueSchema,
} from "@alfred/type/preference";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type Context } from "../context";
import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

function mapPreferenceResource(
  _input: unknown,
  ctx: { session: { user?: { id?: string } } | null }
) {
  const userId = ctx.session?.user?.id ?? "anonymous";
  return {
    id: userId,
    kind: "preference" as const,
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

function modelRoleFromPreferenceKey(key: string): ModelRole | null {
  const prefix = "domain.ai.model.";
  if (!key.startsWith(prefix)) {
    return null;
  }

  const role = key.slice(prefix.length);
  if (!isModelRole(role)) {
    return null;
  }

  return role;
}

function coerceModelRef(raw: string): string {
  const value = raw.trim();
  if (value.length === 0) {
    return value;
  }
  if (value.includes(":")) {
    return value;
  }

  const slash = value.indexOf("/");
  if (slash !== -1) {
    const provider = value.slice(0, slash).trim();
    const modelId = value.slice(slash + 1).trim();
    return `${provider}:${modelId}`;
  }

  // Back-compat: older inputs used bare model ids (assume OpenAI).
  return `openai:${value}`;
}

function normalizePreferenceValue(key: string, value: unknown): unknown {
  if (!modelRoleFromPreferenceKey(key)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "invalid_model_preference_value",
    });
  }

  try {
    return parseModelRef(coerceModelRef(value)).ref;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "invalid_model_ref",
    });
  }
}

async function invalidateUserPreferenceCache(
  userId: string,
  projectId?: string
): Promise<void> {
  const { invalidatePreferenceCache } =
    await import("@alfred/agent/preference/loader");
  if (projectId) {
    await invalidatePreferenceCache(userId, projectId);
    return;
  }
  await invalidatePreferenceCache(userId);
}

export const preferenceRouter = router({
  list: authedProcedure
    .input(preferenceListSchema.optional())
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const params = preferenceListSchema.parse(input ?? {});
      const preferences = params.projectId
        ? await userRepo.getPreferences(session.user.id, params.projectId)
        : await userRepo.getPreferences(session.user.id);
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
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const value = normalizePreferenceValue(input.key, input.value);

      const preference = input.projectId
        ? await userRepo.setPreference(
            session.user.id,
            input.key,
            value,
            input.confidence ?? 1,
            input.source ?? "user",
            input.projectId
          )
        : await userRepo.setPreference(
            session.user.id,
            input.key,
            value,
            input.confidence ?? 1,
            input.source ?? "user"
          );

      await invalidateUserPreferenceCache(session.user.id, input.projectId);

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
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const removed = input.projectId
        ? Number(
            await userRepo.deletePreference(
              session.user.id,
              input.key,
              input.projectId
            )
          ) || 0
        : Number(await userRepo.deletePreference(session.user.id, input.key)) ||
          0;

      await invalidateUserPreferenceCache(session.user.id, input.projectId);
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
        conversationId: z.string().min(1).optional(),
        messageId: z.string().min(1),
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
        projectId: z.string().uuid().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string().min(1)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const ownedMessage = await ensureMessageOwnership({
        messageId: input.messageId,
        userId: session.user.id,
      });

      let updated = 0;
      for (const [key, value] of Object.entries(input.preferenceUpdates)) {
        const normalized = normalizePreferenceValue(key, value);
        if (input.projectId) {
          await userRepo.setPreference(
            session.user.id,
            key,
            normalized,
            0.9,
            "learned",
            input.projectId
          );
        } else {
          await userRepo.setPreference(
            session.user.id,
            key,
            normalized,
            0.9,
            "learned"
          );
        }
        updated += 1;
      }

      if (updated > 0) {
        await invalidateUserPreferenceCache(session.user.id, input.projectId);
        recordMemoryUpdate("preference", "learned");
      }

      if (input.rating || (input.tags && input.tags.length > 0)) {
        const conversationId =
          input.conversationId ?? ownedMessage.conversationId ?? "";
        if (input.projectId) {
          await userRepo.addFeedback(
            session.user.id,
            conversationId,
            input.messageId,
            input.rating,
            undefined,
            input.tags,
            input.projectId
          );
        } else {
          await userRepo.addFeedback(
            session.user.id,
            conversationId,
            input.messageId,
            input.rating,
            undefined,
            input.tags
          );
        }
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
        correctedMessageId: z.string().min(1),
        correctionType: z.enum(["verbosity", "tone", "format", "content"]),
        originalMessageId: z.string().min(1),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      const [original, corrected] = await Promise.all([
        ensureMessageOwnership({
          messageId: input.originalMessageId,
          userId: session.user.id,
        }),
        ensureMessageOwnership({
          messageId: input.correctedMessageId,
          userId: session.user.id,
        }),
      ]);

      const { inferPreferenceFromCorrection } =
        await import("@alfred/agent/preference/inference");
      const inferred = await inferPreferenceFromCorrection(
        conversationRepo.messageRowToUIMessage(original),
        conversationRepo.messageRowToUIMessage(corrected),
        input.correctionType
      );

      if (!inferred) {
        return { inferred: 0 };
      }

      if (input.projectId) {
        await userRepo.setPreference(
          session.user.id,
          inferred.key,
          inferred.value,
          0.7,
          "inferred",
          input.projectId
        );
      } else {
        await userRepo.setPreference(
          session.user.id,
          inferred.key,
          normalizePreferenceValue(inferred.key, inferred.value),
          0.7,
          "inferred"
        );
      }
      await invalidateUserPreferenceCache(session.user.id, input.projectId);
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
        correctDomain: z.string().min(1).max(100),
        incorrectDomain: z.string().min(1).max(100).optional(),
        text: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      ensureObligations(ctx);

      {
        const { learnDomainCorrection } =
          await import("@alfred/agent/orchestrator/learning-worker");
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
