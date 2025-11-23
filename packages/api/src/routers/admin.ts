import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getVoicePools } from "../voice/pools";

export const adminRouter = router({
  getVoiceStats: protectedProcedure.query(async () => {
    // TODO: Add requireElevated(ctx) check here
    try {
      const { voiceRegistry } = getVoicePools();
      return voiceRegistry.getStats();
    } catch (error) {
      // If pools are not initialized (e.g. VOICE_PROVIDER=openai), return empty stats
      return {
        activeSessions: 0,
        sttPool: null,
        ttsPool: null,
        message: "Voice pools not active (likely using cloud provider)",
      };
    }
  }),

  restartVoicePool: protectedProcedure
    .input(z.object({ pool: z.enum(["stt", "tts"]) }))
    .mutation(async ({ input }) => {
      // TODO: Add requireElevated(ctx) check here
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
});
