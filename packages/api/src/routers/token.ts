import { requireRecentBiometric } from "@alfred/auth/biometric";
import { issueAccessToken } from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const scopesSchema = z.array(z.string().trim().min(1)).min(1);
const ttlSchema = z.number().int().min(60).max(900).optional();

export const tokenRouter = router({
  issue: authedProcedure
    .use(requirePolicy("token.issue"))
    .input(
      z.object({
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
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
        ttlSec: input.ttlSec,
        elevated: false,
        mfa: "none",
      });
      return { token };
    }),
  elevate: authedProcedure
    .use(requirePolicy("token.elevate"))
    .input(
      z.object({
        scopes: scopesSchema,
        aud: z.string().trim().min(1).optional(),
        ttlSec: ttlSchema,
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
        ttlSec: input.ttlSec,
        elevated: true,
        mfa: "passkey",
      });
      return { token };
    }),
});
