import { resolveSttLanguagePreference } from "@alfred/voice/services/config";
import { requirePolicy } from "../../gate";
import { authedProcedure } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import {
  sttInput,
  sttSessionInput,
  sttStreamingInput,
  toSttResource,
} from "./schema";

export const voiceSttTranscribeProcedure = authedProcedure
  .use(requirePolicy("voice.stt", toSttResource))
  .input(sttInput)
  .mutation(async ({ input, ctx }) => {
    const session = ctx.session;
    let language = input.language;

    if (session) {
      language = await resolveSttLanguagePreference(
        session.user.id,
        input.language
      );
    }

    try {
      const [{ transcribeLocal }, { getVoicePools }] = await Promise.all([
        import("@alfred/voice/services/stt"),
        import("../../voice/pools"),
      ]);
      const { sttPool } = getVoicePools();
      return await transcribeLocal(sttPool, { ...input, language });
    } catch (error) {
      throw toTRPCError(error, "voice_stt_failed");
    }
  });

export const voiceSttTranscribeStreamingProcedure = authedProcedure
  .use(requirePolicy("voice.stt", toSttResource))
  .input(sttStreamingInput)
  .mutation(async ({ input, ctx }) => {
    const session = ctx.session;
    let language = input.language;

    if (session) {
      language = await resolveSttLanguagePreference(
        session.user.id,
        input.language
      );
    }

    try {
      const [{ transcribeStreaming }, { getVoicePools }] = await Promise.all([
        import("@alfred/voice/services/stt"),
        import("../../voice/pools"),
      ]);
      const { sttPool } = getVoicePools();
      return await transcribeStreaming(sttPool, {
        ...input,
        language,
      });
    } catch (error) {
      throw toTRPCError(error, "voice_stt_streaming_failed");
    }
  });

export const voiceSttClearCacheProcedure = authedProcedure
  .input(sttSessionInput)
  .mutation(async ({ input }) => {
    try {
      const [{ clearStreamingCache }, { getVoicePools }] = await Promise.all([
        import("@alfred/voice/services/stt"),
        import("../../voice/pools"),
      ]);
      const { sttPool } = getVoicePools();
      const cleared = await clearStreamingCache(sttPool, input.sessionId);
      return { cleared, sessionId: input.sessionId };
    } catch (error) {
      throw toTRPCError(error, "voice_stt_clear_cache_failed");
    }
  });

export const voiceSttReleaseSessionProcedure = authedProcedure
  .input(sttSessionInput)
  .mutation(async ({ input }) => {
    try {
      const [{ releaseStreamingSession }, { getVoicePools }] =
        await Promise.all([
          import("@alfred/voice/services/stt"),
          import("../../voice/pools"),
        ]);
      const { sttPool } = getVoicePools();
      releaseStreamingSession(sttPool, input.sessionId);
      return { released: true, sessionId: input.sessionId };
    } catch (error) {
      throw toTRPCError(error, "voice_stt_release_session_failed");
    }
  });

export const voiceSttSessionInfoProcedure = authedProcedure
  .input(sttSessionInput)
  .query(async ({ input }) => {
    try {
      const [{ getStreamingSessionInfo }, { getVoicePools }] =
        await Promise.all([
          import("@alfred/voice/services/stt"),
          import("../../voice/pools"),
        ]);
      const { sttPool } = getVoicePools();
      const info = getStreamingSessionInfo(sttPool, input.sessionId);
      return { sessionId: input.sessionId, ...info };
    } catch (error) {
      throw toTRPCError(error, "voice_stt_session_info_failed");
    }
  });
