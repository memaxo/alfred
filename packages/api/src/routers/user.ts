import { getPreferences, setPreference } from "@alfred/db/repo/user";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

export const userRouter = router({
  getPreferences: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    const prefs = await getPreferences(session.user.id);
    return Array.isArray(prefs) ? prefs : [];
  }),

  setPreference: authedProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
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

      return await setPreference(
        session.user.id,
        input.key,
        input.value,
        1.0,
        "user"
      );
    }),

  registerPushToken: authedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "web"]),
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

      const key = `push_token_${input.platform}`;
      await setPreference(session.user.id, key, input.token, 1.0, "device");
      return { stored: true };
    }),
});
