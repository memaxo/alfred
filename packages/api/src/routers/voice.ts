import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import type { VoiceStreamEvent } from "@alfred/type/voice";
import {
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
} from "@alfred/voice/metrics";
import {
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  getVoiceProvider,
  resolveSttLanguagePreference,
  resolveVoicePreference,
} from "@alfred/voice/services/config";
import {
  downloadModel,
  listAvailableModels,
  listVoices,
} from "@alfred/voice/services/models";
import { type SttInput, transcribeLocal } from "@alfred/voice/services/stt";
import { synthesizeLocal, type TtsInput } from "@alfred/voice/services/tts";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { runAssistantForVoice } from "../voice/assistant";
import { getVoicePools } from "../voice/pools";
import {
  claimVoiceSession,
  completeVoiceSession,
  getVoiceSession,
  listVoiceSessions,
  markVoiceSessionError,
  releaseVoiceSession,
  updateVoiceSession,
} from "../voice/session-registry";

const sttInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required").default("audio/webm"),
  model: z.string().min(1).default(DEFAULT_STT_MODEL),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
});

const ttsInput = z.object({
  text: z.string().min(1, "text_required").max(600, "text_too_long"),
  voice: z.string().min(1).default(DEFAULT_TTS_VOICE),
  format: z.enum(["mp3", "opus", "wav"]).default("mp3"),
  model: z.string().min(1).default(DEFAULT_TTS_MODEL),
});

const voicePreviewInput = z.object({
  voice: z.string().min(1),
  text: z
    .string()
    .min(1)
    .max(100)
    .default("Hello, this is a preview of my voice."),
});

const voiceSurfaceInput = z.enum([
  "drive",
  "carplay",
  "web",
  "native",
  "stream",
  "unknown",
]);

const voiceStreamInput = z.object({
  mode: z.enum(["clip", "stream"]).default("stream"),
  sessionId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  surface: voiceSurfaceInput.optional(),
});

const s2sInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required"),
  thread: z.string().optional(),
  resource: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
  sttModel: z.string().min(1).default(DEFAULT_STT_MODEL),
  ttsModel: z.string().min(1).default(DEFAULT_TTS_MODEL),
  ttsVoice: z.string().min(1).default(DEFAULT_TTS_VOICE),
  ttsFormat: z.enum(["mp3", "opus", "wav"]).default("mp3"),
  sessionId: z.string().min(8).max(64).optional(),
  surface: voiceSurfaceInput.default("web"),
  inputCodec: z.string().optional(),
  outputCodec: z.string().optional(),
});

const voiceSessionStatusInput = z
  .object({
    sessionId: z.string().optional(),
  })
  .optional();

const voiceDownloadInput = z.object({
  voiceId: z.string().min(1),
});

const toSttResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<z.infer<typeof sttInput>>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_STT_MODEL,
  };
};

const toTtsResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<z.infer<typeof ttsInput>>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_TTS_MODEL,
  };
};

function toTRPCError(
  error: unknown,
  code: TRPCError["code"] = "INTERNAL_SERVER_ERROR"
) {
  if (error instanceof TRPCError) {
    return error;
  }
  return new TRPCError({
    code,
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
}

export const voiceRouter = router({
  sttTranscribe: authedProcedure
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
        const { sttPool } = getVoicePools();
        return await transcribeLocal(sttPool, { ...input, language });
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  ttsSynthesize: authedProcedure
    .use(requirePolicy("voice.tts", toTtsResource))
    .input(ttsInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const voice = await resolveVoicePreference(session.user.id, input.voice);

      try {
        const { ttsPool } = getVoicePools();
        return await synthesizeLocal(ttsPool, { ...input, voice });
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  speechToSpeech: authedProcedure
    .use(requirePolicy("voice.stt", toSttResource))
    .use(requirePolicy("voice.tts", toTtsResource))
    .input(s2sInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
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

        const { sttPool, ttsPool } = getVoicePools();
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
        throw toTRPCError(error);
      }
    }),

  listAvailableModels: authedProcedure.query(async () => listAvailableModels()),

  downloadModel: authedProcedure
    .input(voiceDownloadInput)
    .mutation(async ({ input }) => {
      try {
        return await downloadModel(input.voiceId);
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  listVoices: authedProcedure.query(async () => listVoices()),

  previewVoice: authedProcedure
    .input(voicePreviewInput)
    .mutation(async ({ input }) => {
      try {
        const { ttsPool } = getVoicePools();
        return await synthesizeLocal(ttsPool, {
          text: input.text,
          voice: input.voice,
          format: "mp3",
          model: "piper",
        });
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  sessions: authedProcedure
    .input(voiceSessionStatusInput)
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (input?.sessionId) {
        const snapshot = await getVoiceSession(input.sessionId);
        if (!snapshot || snapshot.userId !== session.user.id) {
          return [];
        }
        return [snapshot];
      }
      return listVoiceSessions(session.user.id);
    }),

  endSession: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const snapshot = await getVoiceSession(input.sessionId);
      if (snapshot && snapshot.userId === session.user.id) {
        await releaseVoiceSession(input.sessionId);
      }
    }),

  stream: authedProcedure
    .input(voiceStreamInput)
    .subscription(({ input, ctx }) =>
      observable<VoiceStreamEvent>((emit) => {
        const session = ctx.session;
        if (!session) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        const sessionId = input.sessionId ?? randomUUID();
        const timerStart = performance.now();
        markVoice("voice_stream_start");
        voiceStreamEventsTotal.inc({ event: "status", status: "connecting" });

        try {
          const { voiceRegistry } = getVoicePools();
          voiceRegistry.createSession(
            session.user.id,
            sessionId,
            input.language
          );

          emit.next({
            type: "status",
            status: "connected",
            timestamp: Date.now(),
          } as any);
          voiceStreamEventsTotal.inc({ event: "status", status: "connected" });
          markVoice("voice_stream_connected");

          return () => {
            const durationSeconds = (performance.now() - timerStart) / 1000;
            voiceStreamLatencySeconds.observe(
              { stage: "stream_session" },
              durationSeconds
            );
            voiceStreamEventsTotal.inc({
              event: "status",
              status: "disconnected",
            });
            markVoice("voice_stream_end");
            voiceRegistry.removeSession(sessionId);
            emit.next({
              type: "status",
              status: "disconnected",
              timestamp: Date.now(),
            } as any);
          };
        } catch (error) {
          voiceStreamEventsTotal.inc({ event: "error", status: "error" });
          markVoice("voice_stream_error");
          emit.error(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "voice_stream_setup_failed",
              cause: error instanceof Error ? error : undefined,
            })
          );
          return () => {};
        }
      })
    ),
});
