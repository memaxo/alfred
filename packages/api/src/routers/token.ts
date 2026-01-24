import { requireRecentBiometric } from "@alfred/auth/biometric";
import { issueAccessToken } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const scopesSchema = z.array(z.string().trim().min(1)).min(1);
const ttlSchema = z.number().int().min(60).max(900).optional();

// In-memory token metadata storage (would be persisted in DB after migration)
type TokenMetadata = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
const tokenMetadataStore = new Map<string, TokenMetadata>();

function getTokenPrefix(token: string): string {
  // Return first 8 chars as prefix for display
  return token.slice(0, 8);
}

export const tokenRouter = router({
  issue: authedProcedure
    .use(requirePolicy("token.issue"))
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
        name: z.string().trim().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as
        | (typeof ctx.session & { id?: string; scopes?: string[] })
        | undefined;
      const userId = user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const audience = input.aud ?? process.env.TOOL_AUDIENCE ?? "alfred:tools";
      const token = await issueAccessToken(userId, input.scopes, audience, {
        projectId: input.projectId,
        ttlSec: input.ttlSec,
        elevated: false,
        mfa: "none",
      });

      // Store token metadata
      const tokenId = crypto.randomUUID();
      const metadata: TokenMetadata = {
        id: tokenId,
        userId,
        name: input.name ?? `Token ${new Date().toISOString().slice(0, 10)}`,
        prefix: getTokenPrefix(token),
        scopes: input.scopes,
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: input.ttlSec
          ? new Date(Date.now() + input.ttlSec * 1000)
          : null,
        revokedAt: null,
      };
      tokenMetadataStore.set(tokenId, metadata);

      logger.info("token_issued", {
        tokenId,
        userId,
        scopes: input.scopes,
        elevated: false,
      });

      return { token, tokenId };
    }),
  elevate: authedProcedure
    .use(requirePolicy("token.elevate"))
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
        name: z.string().trim().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const elevatedUser = ctx.session?.user as
        | (typeof ctx.session & { id?: string; scopes?: string[] })
        | undefined;
      const userId = elevatedUser?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const sessionRecord = (
        ctx.session as
          | { session?: { id?: string; token?: string } }
          | null
          | undefined
      )?.session;
      const sessionId = sessionRecord?.id ?? sessionRecord?.token;
      if (!sessionId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      try {
        await requireRecentBiometric(sessionId);
      } catch (error) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            error instanceof Error ? error.message : "biometric_required",
        });
      }
      const audience = input.aud ?? process.env.TOOL_AUDIENCE ?? "alfred:tools";
      const token = await issueAccessToken(userId, input.scopes, audience, {
        projectId: input.projectId,
        ttlSec: input.ttlSec,
        elevated: true,
        mfa: "passkey",
      });

      // Store token metadata
      const tokenId = crypto.randomUUID();
      const metadata: TokenMetadata = {
        id: tokenId,
        userId,
        name:
          input.name ??
          `Elevated Token ${new Date().toISOString().slice(0, 10)}`,
        prefix: getTokenPrefix(token),
        scopes: input.scopes,
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: input.ttlSec
          ? new Date(Date.now() + input.ttlSec * 1000)
          : null,
        revokedAt: null,
      };
      tokenMetadataStore.set(tokenId, metadata);

      logger.info("token_issued", {
        tokenId,
        userId,
        scopes: input.scopes,
        elevated: true,
      });

      return { token, tokenId };
    }),

  list: authedProcedure.query(({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const tokens = [...tokenMetadataStore.values()]
      .filter((t) => t.userId === userId && !t.revokedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        prefix: t.prefix,
        scopes: t.scopes,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        isExpired: t.expiresAt ? t.expiresAt < new Date() : false,
      })),
    };
  }),

  revoke: authedProcedure
    .input(z.object({ tokenId: z.string().uuid() }))
    .mutation(({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const token = tokenMetadataStore.get(input.tokenId);
      if (!token || token.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "token_not_found",
        });
      }

      if (token.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "token_already_revoked",
        });
      }

      token.revokedAt = new Date();
      tokenMetadataStore.set(input.tokenId, token);

      logger.info("token_revoked", {
        tokenId: input.tokenId,
        userId,
      });

      return { revoked: true, tokenId: input.tokenId };
    }),
});
