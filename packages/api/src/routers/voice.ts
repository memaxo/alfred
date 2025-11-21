import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import type { Response } from "undici";
import { z } from "zod";
import type { VoiceStreamEvent } from "@alfred/type/voice";
import { markVoice } from "@alfred/metrics/performance";
import { requirePolicy } from "../gate";
import {
  recordVoiceStt,
  recordVoiceTts,
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
} from "@alfred/api/metrics";
import { authedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";
import { getVoicePools } from "../voice/pools";
import { randomUUID } from "node:crypto";
import { runAssistantForVoice } from "../voice/assistant";
import {
  decodeToPCM16,
  encodeFromPCM16,
  isLikelyPCM,
  PCM_MIME_TYPE,
} from "../voice/codec";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MiB cap for initial MVP clips
const DEFAULT_STT_MODEL = "whisper-1";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";

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

const voiceStreamInput = z.object({
  mode: z.enum(["clip", "stream"]).default("stream"),
  sessionId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
});

type SttInput = z.infer<typeof sttInput>;
type TtsInput = z.infer<typeof ttsInput>;
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
});

type SpeechToSpeechInput = z.infer<typeof s2sInput>;

function getVoiceProvider(): "openai" | "local" {
  return (process.env.VOICE_PROVIDER ?? "openai") as "openai" | "local";
}

function requireOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "openai_api_key_missing",
    });
  }
  const baseUrl = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function transcribeLocal(input: SttInput): Promise<{
  text: string;
  language: string | null;
  model: string;
  provider: string;
  durationSeconds: number;
}> {
  const timerStart = performance.now();
  markVoice("stt_local_start");
  
  const { sttPool } = getVoicePools();

  try {
    const normalized = await normalizeLocalSttAudio(input);
    const result = await sttPool.transcribe({
      audioBase64: normalized.audioBase64,
      mimeType: normalized.mimeType,
      language: input.language,
      prompt: input.prompt,
      streaming: false,
    });

    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_local_complete");
    voiceStreamLatencySeconds.observe({ stage: "stt_transcribe" }, durationSeconds);
    recordVoiceStt({ provider: "local", status: "ok", durationSeconds });

    return {
      text: result.text,
      language: result.language ?? null,
      model: result.model ?? "faster-whisper-large-v3-turbo",
      provider: "local",
      durationSeconds,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_local_error");
    voiceStreamLatencySeconds.observe({ stage: "stt_transcribe" }, durationSeconds);
    recordVoiceStt({ provider: "local", status: "error", durationSeconds });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "local_transcription_failed",
      cause: error instanceof Error ? error : undefined,
    });
  }
}

async function synthesizeLocal(input: TtsInput): Promise<{
  audioBase64: string;
  mimeType: string;
  model: string;
  provider: string;
  durationSeconds: number;
}> {
  const timerStart = performance.now();
  markVoice("tts_local_start");
  
  const { ttsPool } = getVoicePools();

  try {
    // Map OpenAI voice names to Piper voices
    const voiceMap: Record<string, string> = {
      alloy: "en_US-lessac-medium",
      echo: "en_US-lessac-medium",
      fable: "en_US-lessac-medium",
      onyx: "en_US-lessac-medium",
      nova: "en_US-lessac-medium",
      shimmer: "en_US-lessac-medium",
    };
    const piperVoice = voiceMap[input.voice] ?? input.voice;

    const result = await ttsPool.synthesize({
      text: input.text,
      voice: piperVoice,
      streaming: false,
    });

    const encoded = await encodeLocalTtsAudio(result.audioBase64, input.format);
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("tts_local_complete");
    voiceStreamLatencySeconds.observe({ stage: "tts_synthesize" }, durationSeconds);
    recordVoiceTts({ provider: "local", status: "ok", durationSeconds });

    return {
      audioBase64: encoded.audioBase64,
      mimeType: encoded.mimeType,
      model: input.voice ?? "piper",
      provider: "local",
      durationSeconds,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("tts_local_error");
    voiceStreamLatencySeconds.observe({ stage: "tts_synthesize" }, durationSeconds);
    recordVoiceTts({ provider: "local", status: "error", durationSeconds });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "local_synthesis_failed",
      cause: error instanceof Error ? error : undefined,
    });
  }
}

function sanitizeBase64(raw: string) {
  const commaIndex = raw.indexOf(",");
  return commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw.trim();
}

function inferExtension(mimeType: string) {
  const mapping: Record<string, string> = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "opus",
    "audio/mp4": "mp4",
    "audio/aac": "aac",
  };
  return mapping[mimeType.toLowerCase()] ?? "webm";
}

function formatToMime(format: TtsInput["format"]) {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "opus":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    default:
      return "audio/mpeg";
  }
}

async function normalizeLocalSttAudio(input: SttInput) {
  const sanitized = sanitizeBase64(input.audioBase64);
  if (!sanitized) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "audio_payload_empty",
    });
  }

  if (isLikelyPCM(input.mimeType)) {
    return {
      audioBase64: sanitized,
      mimeType: PCM_MIME_TYPE,
    };
  }

  try {
    const decoded = await decodeToPCM16({
      audioBase64: sanitized,
      mimeType: input.mimeType,
    });
    return {
      audioBase64: decoded.audioBase64,
      mimeType: decoded.mimeType,
    };
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "local_codec_decode_failed",
      cause: error instanceof Error ? error : undefined,
    });
  }
}

async function encodeLocalTtsAudio(
  audioBase64: string,
  format: TtsInput["format"]
) {
  try {
    const encoded = await encodeFromPCM16({
      audioBase64: sanitizeBase64(audioBase64),
      format,
    });
    return encoded;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "local_codec_encode_failed",
      cause: error instanceof Error ? error : undefined,
    });
  }
}

async function postTranscription(input: SttInput) {
  const { apiKey, baseUrl } = requireOpenAIConfig();
  const cleaned = sanitizeBase64(input.audioBase64);
  const audioBuffer = Buffer.from(cleaned, "base64");
  if (audioBuffer.byteLength === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "audio_payload_empty",
    });
  }
  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "audio_payload_too_large",
    });
  }

  const fileName = `speech.${inferExtension(input.mimeType)}`;
  const form = new FormData();
  form.append(
    "file",
    new File([audioBuffer], fileName, { type: input.mimeType })
  );
  form.append("model", input.model);
  form.append("response_format", "verbose_json");
  if (input.language) {
    form.append("language", input.language);
  }
  if (input.prompt) {
    form.append("prompt", input.prompt);
  }

  const url = `${baseUrl}/v1/audio/transcriptions`;
  const timerStart = performance.now();
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
  } catch (error) {
    recordVoiceStt({ provider: "openai", status: "error" });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "openai_transcription_network_error",
      cause: error instanceof Error ? error : undefined,
    });
  }

  const durationSeconds = (performance.now() - timerStart) / 1000;
  const providerLabel = "openai";

  if (!response.ok) {
    recordVoiceStt({
      provider: providerLabel,
      status: "error",
      durationSeconds,
    });
    const errorPayload = await safeReadError(response);
    throw new TRPCError({
      code: response.status === 401 ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR",
      message: "openai_transcription_failed",
      cause: errorPayload,
    });
  }

  const payload = (await response
    .json()
    .catch(() => ({ text: "", language: null }))) as {
    text?: unknown;
    language?: unknown;
  };
  const text = typeof payload.text === "string" ? payload.text : "";
  const language =
    typeof payload.language === "string" ? payload.language : null;

  if (!text) {
    recordVoiceStt({
      provider: providerLabel,
      status: "error",
      durationSeconds,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "openai_transcription_empty",
    });
  }

  recordVoiceStt({ provider: providerLabel, status: "ok", durationSeconds });

  return {
    text,
    language,
    model: input.model,
    provider: providerLabel,
    durationSeconds,
  };
}

async function postSynthesis(input: TtsInput) {
  const { apiKey, baseUrl } = requireOpenAIConfig();
  const mimeType = formatToMime(input.format);
  const url = `${baseUrl}/v1/audio/speech`;
  const payload = {
    model: input.model,
    voice: input.voice,
    format: input.format,
    input: input.text,
  };

  const timerStart = performance.now();
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    recordVoiceTts({ provider: "openai", status: "error" });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "openai_synthesis_network_error",
      cause: error instanceof Error ? error : undefined,
    });
  }

  const durationSeconds = (performance.now() - timerStart) / 1000;
  const providerLabel = "openai";

  if (!response.ok) {
    recordVoiceTts({
      provider: providerLabel,
      status: "error",
      durationSeconds,
    });
    const errorPayload = await safeReadError(response);
    throw new TRPCError({
      code: response.status === 401 ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR",
      message: "openai_synthesis_failed",
      cause: errorPayload,
    });
  }

  const audioBuffer = await response.arrayBuffer();
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    recordVoiceTts({
      provider: providerLabel,
      status: "error",
      durationSeconds,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "openai_synthesis_empty",
    });
  }

  const audioBase64 = Buffer.from(audioBuffer).toString("base64");
  recordVoiceTts({ provider: providerLabel, status: "ok", durationSeconds });
  return {
    audioBase64,
    mimeType,
    model: input.model,
    provider: providerLabel,
    durationSeconds,
  };
}

async function safeReadError(response: Response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      return payload;
    }
  } catch (error) {
    logger.debug("error_response_json_parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    return await response.text();
  } catch (error) {
    logger.warn("error_response_text_parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const toSttResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<SttInput>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_STT_MODEL,
  };
};

const toTtsResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<TtsInput>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_TTS_MODEL,
  };
};

export const voiceRouter: ReturnType<typeof router> = router({
  sttTranscribe: authedProcedure
    .use(requirePolicy("voice.stt", toSttResource))
    .input(sttInput)
    .mutation(async ({ input }) => {
      const provider = getVoiceProvider();
      if (provider === "local") {
        return transcribeLocal(input);
      }
      return postTranscription(input);
    }),

  ttsSynthesize: authedProcedure
    .use(requirePolicy("voice.tts", toTtsResource))
    .input(ttsInput)
    .mutation(async ({ input }) => {
      const provider = getVoiceProvider();
      if (provider === "local") {
        return synthesizeLocal(input);
      }
      return postSynthesis(input);
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

      const sttPayload: SttInput = {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        model: input.sttModel,
        language: input.language,
        prompt: input.prompt,
      };
      const sttResult =
        provider === "local"
          ? await transcribeLocal(sttPayload)
          : await postTranscription(sttPayload);

      const transcriptText = sttResult.text?.trim();
      if (!transcriptText) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "transcription_empty",
        });
      }

      const assistantResult = await runAssistantForVoice(
        ctx.runtimeContext,
        {
          text: transcriptText,
          thread: input.thread,
          resource: input.resource,
          userId: session.user.id,
        }
      );

      const ttsPayload: TtsInput = {
        text: assistantResult.text || "I heard you.",
        voice: input.ttsVoice,
        format: input.ttsFormat,
        model: input.ttsModel,
      };
      const ttsResult =
        provider === "local"
          ? await synthesizeLocal(ttsPayload)
          : await postSynthesis(ttsPayload);

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
      };
    }),

  stream: authedProcedure
    .input(voiceStreamInput)
    .subscription(({ input, ctx }) => {
      return observable<VoiceStreamEvent>((emit) => {
        const session = ctx.session;
        if (!session) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        const provider = getVoiceProvider();
        if (provider !== "local") {
          emit.error(
            new TRPCError({
              code: "NOT_IMPLEMENTED",
              message: "voice_streaming_requires_local_provider",
            })
          );
          return () => {};
        }

        const sessionId = input.sessionId ?? randomUUID();
        const timerStart = performance.now();
        markVoice("voice_stream_start");
        voiceStreamEventsTotal.inc({ event: "status", status: "connecting" });

        try {
          const { sessionManager } = getVoicePools();
          sessionManager.createSession(
            session.user.id,
            sessionId,
            input.language
          );

          emit.next({
            type: "status",
            status: "connected",
            timestamp: Date.now(),
          });
          voiceStreamEventsTotal.inc({ event: "status", status: "connected" });
          markVoice("voice_stream_connected");

          // Note: Actual audio chunk processing would happen via a separate mechanism
          // This is a basic implementation - full bidirectional streaming requires
          // accepting audio chunks via subscription input, which tRPC doesn't support natively
          // For now, this provides the connection status and structure

          return () => {
            const durationSeconds = (performance.now() - timerStart) / 1000;
            voiceStreamLatencySeconds.observe({ stage: "stream_session" }, durationSeconds);
            voiceStreamEventsTotal.inc({ event: "status", status: "disconnected" });
            markVoice("voice_stream_end");
            sessionManager.removeSession(sessionId);
            emit.next({
              type: "status",
              status: "disconnected",
              timestamp: Date.now(),
            });
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
      });
    }),
});
