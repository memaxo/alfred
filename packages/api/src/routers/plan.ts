import { z } from "zod";
import { authedProcedure, router } from "../trpc.js";
import { parseIntent } from "@alfred/plan/intent";
import { TRPCError } from "@trpc/server";

/**
 * planRouter: Handles AI-native workflow planning requests
 */
export const planRouter = router({
  parseIntent: authedProcedure
    .input(z.object({
      input: z.string().min(1).max(500),
      source: z.enum(["voice", "chat", "api"]).default("chat"),
      workspace: z.string().optional(),
      codebase: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const result = await parseIntent(input.input, {
          userId,
          source: input.source,
          workspace: input.workspace,
          codebase: input.codebase,
        });

        return result;
      } catch (error) {
        console.error("Failed to parse intent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_intent_parse_failed",
          cause: error,
        });
      }
    }),
});
