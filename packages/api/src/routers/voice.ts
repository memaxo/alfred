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
import type { SttInput } from "@alfred/voice/services/stt";
import type { TtsInput } from "@alfred/voice/services/tts";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
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

const sttStreamingInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required").default("audio/webm"),
  model: z.string().min(1).default(DEFAULT_STT_MODEL),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
  sessionId: z.string().min(8).max(64),
  chunkSize: z.enum(["fast", "low", "medium", "accurate"]).optional(),
  clearCache: z.boolean().optional(),
});

const sttSessionInput = z.object({
  sessionId: z.string().min(8).max(64),
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
        const [{ transcribeLocal }, { getVoicePools }] = await Promise.all([
          import("@alfred/voice/services/stt"),
          import("../voice/pools"),
        ]);
        const { sttPool } = getVoicePools();
        return await transcribeLocal(sttPool, { ...input, language });
      } catch (error) {
        throw toTRPCError(error, "voice_stt_failed");
      }
    }),

  /**
   * Streaming transcription with cache-aware session affinity.
   *
   * Use this for real-time voice input where you want:
   * - Lower latency via incremental processing
   * - Session state maintained across audio chunks
   * - Partial results as audio streams in
   *
   * The sessionId ensures requests route to the same worker process,
   * enabling Nemotron's cache-aware streaming mode.
   */
  sttTranscribeStreaming: authedProcedure
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
          import("../voice/pools"),
        ]);
        const { sttPool } = getVoicePools();
        return await transcribeStreaming(sttPool, {
          ...input,
          language,
        });
      } catch (error) {
        throw toTRPCError(error, "voice_stt_streaming_failed");
      }
    }),

  /**
   * Clear the streaming cache for a session.
   * Call this when starting a new utterance to reset decoder state.
   */
  sttClearCache: authedProcedure
    .input(sttSessionInput)
    .mutation(async ({ input }) => {
      try {
        const [{ clearStreamingCache }, { getVoicePools }] = await Promise.all([
          import("@alfred/voice/services/stt"),
          import("../voice/pools"),
        ]);
        const { sttPool } = getVoicePools();
        const cleared = await clearStreamingCache(sttPool, input.sessionId);
        return { cleared, sessionId: input.sessionId };
      } catch (error) {
        throw toTRPCError(error, "voice_stt_clear_cache_failed");
      }
    }),

  /**
   * Release session affinity for a streaming session.
   * Call this when a voice session ends to free up resources.
   */
  sttReleaseSession: authedProcedure
    .input(sttSessionInput)
    .mutation(async ({ input }) => {
      try {
        const [{ releaseStreamingSession }, { getVoicePools }] =
          await Promise.all([
            import("@alfred/voice/services/stt"),
            import("../voice/pools"),
          ]);
        const { sttPool } = getVoicePools();
        releaseStreamingSession(sttPool, input.sessionId);
        return { released: true, sessionId: input.sessionId };
      } catch (error) {
        throw toTRPCError(error, "voice_stt_release_session_failed");
      }
    }),

  /**
   * Get streaming session info for debugging/monitoring.
   */
  sttSessionInfo: authedProcedure
    .input(sttSessionInput)
    .query(async ({ input }) => {
      try {
        const [{ getStreamingSessionInfo }, { getVoicePools }] =
          await Promise.all([
            import("@alfred/voice/services/stt"),
            import("../voice/pools"),
          ]);
        const { sttPool } = getVoicePools();
        const info = getStreamingSessionInfo(sttPool, input.sessionId);
        return { sessionId: input.sessionId, ...info };
      } catch (error) {
        throw toTRPCError(error, "voice_stt_session_info_failed");
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
        const [{ synthesizeLocal }, { getVoicePools }] = await Promise.all([
          import("@alfred/voice/services/tts"),
          import("../voice/pools"),
        ]);
        const { ttsPool } = getVoicePools();
        return await synthesizeLocal(ttsPool, { ...input, voice });
      } catch (error) {
        throw toTRPCError(error, "voice_tts_failed");
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

        const [
          { transcribeLocal },
          { synthesizeLocal },
          { getVoicePools },
          { runAssistantForVoice },
        ] = await Promise.all([
          import("@alfred/voice/services/stt"),
          import("@alfred/voice/services/tts"),
          import("../voice/pools"),
          import("../voice/assistant"),
        ]);
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
        throw toTRPCError(error, "voice_s2s_failed");
      }
    }),

  listAvailableModels: authedProcedure.query(async () => {
    const { listAvailableModels } = await import(
      "@alfred/voice/services/models"
    );
    return listAvailableModels();
  }),

  downloadModel: authedProcedure
    .input(voiceDownloadInput)
    .mutation(async ({ input }) => {
      try {
        const { downloadModel } = await import("@alfred/voice/services/models");
        return await downloadModel(input.voiceId);
      } catch (error) {
        throw toTRPCError(error, "voice_download_failed");
      }
    }),

  listVoices: authedProcedure.query(async () => {
    const { listVoices } = await import("@alfred/voice/services/models");
    return listVoices();
  }),

  previewVoice: authedProcedure
    .input(voicePreviewInput)
    .mutation(async ({ input }) => {
      try {
        const [{ synthesizeLocal }, { getVoicePools }] = await Promise.all([
          import("@alfred/voice/services/tts"),
          import("../voice/pools"),
        ]);
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

  /**
   * Voice pipeline health check.
   *
   * Returns the health status of STT and TTS pools, and optionally
   * runs a quick roundtrip test to verify the full pipeline works.
   */
  health: authedProcedure
    .input(
      z
        .object({
          runRoundtrip: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const startTime = performance.now();

      try {
        const { sttPool, ttsPool } = getVoicePools();

        // Get pool health
        const sttHealth = sttPool.getHealth();
        const ttsHealth = ttsPool.getHealth();

        const healthResult: {
          stt: { ok: boolean; workers: number; activeCount: number };
          tts: { ok: boolean; workers: number; activeCount: number };
          roundtrip?: {
            ok: boolean;
            latencyMs: number;
            originalText: string;
            transcribedText: string;
          };
          totalLatencyMs: number;
        } = {
          stt: {
            ok: Array.isArray(sttHealth) && sttHealth.length > 0,
            workers: Array.isArray(sttHealth) ? sttHealth.length : 0,
            activeCount: sttPool.activeCount,
          },
          tts: {
            ok: Array.isArray(ttsHealth) && ttsHealth.length > 0,
            workers: Array.isArray(ttsHealth) ? ttsHealth.length : 0,
            activeCount: ttsPool.activeCount,
          },
          totalLatencyMs: 0,
        };

        // Optionally run a roundtrip test
        if (input?.runRoundtrip) {
          const roundtripStart = performance.now();
          const testText = "Hello";

          try {
            // TTS: Synthesize test text
            const ttsResult = await ttsPool.synthesize({
              text: testText,
              streaming: false,
            });

            if (!ttsResult.audioBase64) {
              throw new Error("tts_no_audio");
            }

            // STT: Transcribe the audio back
            // Note: We need to resample from TTS output (24kHz) to STT input (16kHz)
            const ttsSampleRate = ttsResult.sampleRate ?? 24_000;

            // Import audio utilities for resampling
            const { decodeToPCM16 } = await import("@alfred/voice/audio/codec");

            // If TTS outputs PCM, use it directly; otherwise decode
            let audioBase64 = ttsResult.audioBase64;
            const mimeType = ttsResult.mimeType ?? "audio/pcm";

            // For PCM output, we may need to resample
            if (
              mimeType.includes("pcm") ||
              mimeType === "audio/raw" ||
              !mimeType.includes("/")
            ) {
              // Resample if needed
              if (ttsSampleRate !== 16_000) {
                const buffer = Buffer.from(audioBase64, "base64");
                const pcm = new Int16Array(
                  buffer.buffer,
                  buffer.byteOffset,
                  buffer.byteLength / 2
                );

                // Simple linear interpolation resampling
                const ratio = ttsSampleRate / 16_000;
                const newLength = Math.floor(pcm.length / ratio);
                const resampled = new Int16Array(newLength);

                for (let i = 0; i < newLength; i++) {
                  const srcIndex = i * ratio;
                  const lower = Math.floor(srcIndex);
                  const upper = Math.min(lower + 1, pcm.length - 1);
                  const fraction = srcIndex - lower;
                  const lowerVal = pcm[lower] ?? 0;
                  const upperVal = pcm[upper] ?? 0;
                  resampled[i] = Math.round(
                    lowerVal * (1 - fraction) + upperVal * fraction
                  );
                }

                audioBase64 = Buffer.from(
                  resampled.buffer,
                  resampled.byteOffset,
                  resampled.byteLength
                ).toString("base64");
              }
            } else {
              // Decode to PCM if not already PCM
              const decoded = await decodeToPCM16({
                audioBase64,
                mimeType,
              });
              audioBase64 = decoded.audioBase64;
            }

            const sttResult = await sttPool.transcribe({
              audioBase64,
              mimeType: "audio/pcm",
              streaming: false,
            });

            const roundtripLatency = performance.now() - roundtripStart;

            healthResult.roundtrip = {
              ok: sttResult.text.length > 0,
              latencyMs: Math.round(roundtripLatency),
              originalText: testText,
              transcribedText: sttResult.text,
            };
          } catch (error) {
            healthResult.roundtrip = {
              ok: false,
              latencyMs: Math.round(performance.now() - roundtripStart),
              originalText: testText,
              transcribedText:
                error instanceof Error ? error.message : "roundtrip_failed",
            };
          }
        }

        healthResult.totalLatencyMs = Math.round(performance.now() - startTime);

        return healthResult;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "voice_health_check_failed",
          cause: error,
        });
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

          emit.next({ _: "status", sessionId, state: "idle" });
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
            emit.next({ _: "status", sessionId, state: "idle" });
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
