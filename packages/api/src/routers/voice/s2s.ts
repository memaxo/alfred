import type { SttInput } from "@alfred/voice/services/stt";
import type { TtsInput } from "@alfred/voice/services/tts";

import { logger } from "@alfred/logger";
import { voiceStreamLatencySeconds } from "@alfred/voice/metrics";
import {
  getVoiceProvider,
  resolveSttLanguagePreference,
  resolveVoicePreference,
} from "@alfred/voice/services/config";
import { TRPCError } from "@trpc/server";
import { performance } from "node:perf_hooks";

import { requirePolicy } from "../../gate";
import { authedProcedure } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import {
  claimVoiceSession,
  completeVoiceSession,
  markVoiceSessionError,
  updateVoiceSession,
} from "../../voice/session-registry";
import { s2sInput, toSttResource, toTtsResource } from "./schema";

export const voiceSpeechToSpeechProcedure = authedProcedure
  .use(requirePolicy("voice.stt", toSttResource))
  .use(requirePolicy("voice.tts", toTtsResource))
  .input(s2sInput)
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const provider = getVoiceProvider();

    const s2sTimerStart = performance.now();

    const claimedSession = await claimVoiceSession({
      userId: session.user.id,
      sessionId: input.sessionId,
      surface: input.surface,
      mode: "clip",
      thread: input.thread,
      resource: input.resource,
      codec: {
        input: input.inputCodec ?? input.mimeType,
        output: input.outputCodec ?? input.ttsFormat,
      },
    });

    try {
      await updateVoiceSession(claimedSession.id, {
        status: "processing",
      });

      let sttLanguage = input.language;
      if (!sttLanguage) {
        sttLanguage = await resolveSttLanguagePreference(
          session.user.id,
          input.language
        );
      }

      const sttPayload: SttInput = {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        model: input.sttModel,
        language: sttLanguage,
        prompt: input.prompt,
      };

      const [
        { transcribeLocal },
        { synthesizeLocal },
        { runAssistantForVoice },
      ] = await Promise.all([
        import("@alfred/voice/services/stt"),
        import("@alfred/voice/services/tts"),
        import("../../voice/assistant"),
      ]);
      const { sttPool, ttsPool } = (
        await import("../../voice/pools")
      ).getVoicePools();

      const sttResult = await transcribeLocal(sttPool, sttPayload);

      const transcriptText = sttResult.text?.trim();
      if (!transcriptText) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "transcription_empty",
        });
      }

      await updateVoiceSession(claimedSession.id, {
        lastTranscript: transcriptText,
      });

      const assistantResult = await runAssistantForVoice(ctx.runtimeContext, {
        text: transcriptText,
        thread: input.thread,
        resource: input.resource,
        userId: session.user.id,
      });

      await updateVoiceSession(claimedSession.id, {
        status: "responding",
        lastAssistantText: assistantResult.text ?? undefined,
      });

      const ttsVoice = await resolveVoicePreference(
        session.user.id,
        input.ttsVoice
      );

      const ttsPayload: TtsInput = {
        text: assistantResult.text || "I heard you.",
        voice: ttsVoice,
        format: input.ttsFormat,
        model: input.ttsModel,
      };

      const ttsResult = await synthesizeLocal(ttsPool, ttsPayload);

      const totalSeconds = (performance.now() - s2sTimerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "speech_to_speech" },
        totalSeconds
      );
      logger.info("voice_s2s_complete", {
        provider,
        sttModel: sttResult.model,
        ttsModel: ttsResult.model,
        totalSeconds,
        sttSeconds: sttResult.durationSeconds,
        ttsSeconds: ttsResult.durationSeconds,
      });

      const finalSession =
        (await completeVoiceSession(claimedSession.id, {
          lastTranscript: transcriptText,
          lastAssistantText: assistantResult.text ?? undefined,
        })) ?? claimedSession;

      return {
        transcript: sttResult,
        assistant: {
          text: assistantResult.text,
          replayId: assistantResult.replayId ?? undefined,
          raw: assistantResult.raw,
        },
        audio: ttsResult,
        durations: {
          totalSeconds,
          sttSeconds: sttResult.durationSeconds ?? null,
          assistantSeconds: assistantResult.durationSeconds,
          ttsSeconds: ttsResult.durationSeconds ?? null,
        },
        session: finalSession,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "error");
      await markVoiceSessionError(claimedSession.id, message);
      throw toTRPCError(error, "voice_s2s_failed");
    }
  });
