import { requireRecentBiometric } from "@alfred/auth/biometric";
import { issueAccessToken } from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { authedProcedure, router } from "../index";

const scopesSchema = z.array(z.string().trim().min(1)).min(1);
const ttlSchema = z.number().int().min(60).max(900).optional();

export const tokenRouter = router({
  issue: authedProcedure
    .input(
      z.object({
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const audience = input.aud ?? process.env.TOOL_AUDIENCE ?? "alfred:tools";
      const token = await issueAccessToken(userId, input.scopes, audience, {
        ttlSec: input.ttlSec,
        elevated: false,
        mfa: "none",
      });
      return { token };
    }),
  elevate: authedProcedure
    .input(
      z.object({
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const sessionRecord = ctx.session.session;
      const sessionId = sessionRecord?.id ?? sessionRecord?.token;
      if (!sessionId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      try {
        await requireRecentBiometric(sessionId);
      } catch (error) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: error instanceof Error ? error.message : "biometric_required",
        });
      }
      const audience = input.aud ?? process.env.TOOL_AUDIENCE ?? "alfred:tools";
      const token = await issueAccessToken(userId, input.scopes, audience, {
        ttlSec: input.ttlSec,
        elevated: true,
        mfa: "passkey",
      });
      return { token };
    }),
});
