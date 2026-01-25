import { resolveVoicePreference } from "@alfred/voice/services/config";
import { TRPCError } from "@trpc/server";

import { requirePolicy } from "../../gate";
import { authedProcedure } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { getVoicePools } from "../../voice/pools";
import { toTtsResource, ttsInput, voicePreviewInput } from "./schema";

export const voiceTtsSynthesizeProcedure = authedProcedure
  .use(requirePolicy("voice.tts", toTtsResource))
  .input(ttsInput)
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const voice = await resolveVoicePreference(session.user.id, input.voice);

    try {
      const { synthesizeLocal } = await import("@alfred/voice/services/tts");
      const { ttsPool } = getVoicePools();
      return await synthesizeLocal(ttsPool, { ...input, voice });
    } catch (error) {
      throw toTRPCError(error, "voice_tts_failed");
    }
  });

export const voicePreviewVoiceProcedure = authedProcedure
  .input(voicePreviewInput)
  .mutation(async ({ input }) => {
    try {
      const { synthesizeLocal } = await import("@alfred/voice/services/tts");
      const { ttsPool } = getVoicePools();
      return await synthesizeLocal(ttsPool, {
        text: input.text,
        voice: input.voice,
        format: "mp3",
        model: "piper",
      });
    } catch (error) {
      throw toTRPCError(error, "voice_preview_failed");
    }
  });
