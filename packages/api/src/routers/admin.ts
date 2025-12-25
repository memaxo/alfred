import { requireRecentBiometric } from "@alfred/auth/biometric";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getVoicePools } from "../voice/pools";
import { collectVoiceTelemetry } from "../voice/telemetry";
import { collectPerformanceTelemetry } from "../performance/telemetry";

type SessionRecord = {
  id?: string;
  token?: string;
};

async function ensureRecentBiometric(session: unknown): Promise<void> {
  const sessionRecord = (
    session as { session?: SessionRecord } | null | undefined
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
      message: error instanceof Error ? error.message : "biometric_required",
    });
  }
}

export const adminRouter = router({
  getVoiceStats: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const telemetry = await collectVoiceTelemetry();
    try {
      const { voiceRegistry } = getVoicePools();
      return { ...voiceRegistry.getStats(), telemetry };
    } catch (_error) {
      // If pools are not initialized (e.g. VOICE_PROVIDER set to cloud/default), return empty stats
      return {
        generatedAt: Date.now(),
        activeSessions: 0,
        sttPool: null,
        ttsPool: null,
        message: "Voice pools not active (likely using cloud provider)",
        telemetry,
      };
    }
  }),

  getPerformanceStats: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    return collectPerformanceTelemetry();
  }),

  restartVoicePool: protectedProcedure
    .input(z.object({ pool: z.enum(["stt", "tts"]) }))
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const { sttPool, ttsPool } = getVoicePools();

      if (input.pool === "stt") {
        await sttPool.shutdown();
        await sttPool.initialize();
        return { success: true, pool: "stt" };
      }

      if (input.pool === "tts") {
        await ttsPool.shutdown();
        await ttsPool.initialize();
        return { success: true, pool: "tts" };
      }
    }),

  clearVoiceSessions: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const { voiceRegistry } = getVoicePools();
    const cleared = voiceRegistry.clearSessions();
    return { cleared };
  }),
});
