import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  recordVoiceStt,
  recordVoiceTts,
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
} from "@alfred/api/metrics";
import { userRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import type { VoiceStreamEvent } from "@alfred/type/voice";
import {
  decodeToPCM16,
  encodeFromPCM16,
  isLikelyPCM,
  PCM_MIME_TYPE,
} from "@alfred/voice/audio/codec";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { Response } from "undici";
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
  sessionId: z.string().min(8).max(64).optional(),
  surface: voiceSurfaceInput.default("web"),
  inputCodec: z.string().optional(),
  outputCodec: z.string().optional(),
});

// type SpeechToSpeechInput = z.infer<typeof s2sInput>;

const voiceSessionStatusInput = z
  .object({
    sessionId: z.string().optional(),
  })
  .optional();

// Simple in-memory cache for available voices (remote)
// let availableVoiceCache: { data: any[]; timestamp: number } | null = null;
// const AVAILABLE_VOICE_CACHE_TTL_MS = 3600 * 1000; // 1 hour

// Simple in-memory cache for voice list (local)
// let voiceListCache: {
//   data: { id: string; name: string }[];
//   timestamp: number;
// } | null = null;
// const VOICE_CACHE_TTL_MS = 60 * 1000; // 1 minute

function getVoiceProvider(): "openai" | "local" {
  return (process.env.VOICE_PROVIDER ?? "openai") as "openai" | "local";
}

async function resolveVoicePreference(
  userId: string,
  requestedVoice: string
): Promise<string> {
  // Only override if the requested voice is the default
  if (requestedVoice !== DEFAULT_TTS_VOICE) {
    return requestedVoice;
  }

  try {
    const prefs = await userRepo.getPreferences(userId);
    const voicePref = Array.isArray(prefs)
      ? prefs.find((p) => p.key === "voice.tts")
      : null;

    if (voicePref?.value && typeof voicePref.value === "string") {
      return voicePref.value;
    }
  } catch (error) {
    logger.warn("failed_to_resolve_voice_preference", { userId, error });
  }

  return requestedVoice;
}

async function resolveSttLanguagePreference(
  userId: string,
  requestedLanguage?: string
): Promise<string | undefined> {
  if (requestedLanguage) {
    return requestedLanguage;
  }

  try {
    const prefs = await userRepo.getPreferences(userId);
    const langPref = Array.isArray(prefs)
      ? prefs.find((p) => p.key === "voice.stt.language")
      : null;

    if (langPref?.value && typeof langPref.value === "string") {
      return langPref.value;
    }
  } catch (error) {
    logger.warn("failed_to_resolve_stt_preference", { userId, error });
  }

  return;
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

  // Backpressure check
  if (sttPool.activeCount >= sttPool.size) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "voice_stt_pool_saturated",
    });
  }

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
    voiceStreamLatencySeconds.observe(
      { stage: "stt_transcribe" },
      durationSeconds
    );
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
    voiceStreamLatencySeconds.observe(
      { stage: "stt_transcribe" },
      durationSeconds
    );
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

  // Backpressure check
  if (ttsPool.activeCount >= ttsPool.size) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "voice_tts_pool_saturated",
    });
  }

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
    voiceStreamLatencySeconds.observe(
      { stage: "tts_synthesize" },
      durationSeconds
    );
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
    voiceStreamLatencySeconds.observe(
      { stage: "tts_synthesize" },
      durationSeconds
    );
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

const voiceDownloadInput = z.object({
  voiceId: z.string().min(1),
});

// Simple in-memory cache for available voices (remote)
let availableVoiceCache: { data: any[]; timestamp: number } | null = null;
const AVAILABLE_VOICE_CACHE_TTL_MS = 3600 * 1000; // 1 hour

// Simple in-memory cache for voice list (local)
let voiceListCache: {
  data: { id: string; name: string }[];
  timestamp: number;
} | null = null;
const VOICE_CACHE_TTL_MS = 60 * 1000; // 1 minute

export const voiceRouter: ReturnType<typeof router> = router({
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

      const provider = getVoiceProvider();
      if (provider === "local") {
        return transcribeLocal({ ...input, language });
      }
      return postTranscription({ ...input, language });
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

      const provider = getVoiceProvider();
      const voice = await resolveVoicePreference(session.user.id, input.voice);

      if (provider === "local") {
        return synthesizeLocal({ ...input, voice });
      }
      return postSynthesis({ ...input, voice });
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
        throw error;
      }
    }),

  listAvailableModels: authedProcedure.query(async () => {
    const provider = getVoiceProvider();
    if (provider !== "local") {
      return [];
    }

    if (
      availableVoiceCache &&
      Date.now() - availableVoiceCache.timestamp < AVAILABLE_VOICE_CACHE_TTL_MS
    ) {
      return availableVoiceCache.data;
    }

    try {
      // We use Bun.spawn to run the python script
      // This requires the python environment to be set up
      // We assume "python3" is available or we should use the same resolution logic as pools
      // For simplicity in this router, we'll try "python3" and expect deps to be installed globally or in venv
      // Ideally we should use a shared helper to run python scripts

      const scriptPath = join(
        process.cwd(),
        "packages/voice/scripts/list_available_voices.py"
      );
      // Use uv run if available, else python3
      const cmd = ["uv", "run", "python", scriptPath];

      const proc = Bun.spawn(cmd, {
        stdout: "pipe",
        stderr: "pipe",
        cwd: join(process.cwd(), "packages/voice"),
      });

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();

      if (error && error.trim().length > 0) {
        // Some stderr is normal logging, but let's log it just in case
        logger.debug("list_available_voices_stderr", { stderr: error });
      }

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Script exited with code ${exitCode}: ${error}`);
      }

      const voices = JSON.parse(output);
      availableVoiceCache = {
        data: voices,
        timestamp: Date.now(),
      };

      return voices;
    } catch (error) {
      logger.warn("failed_to_list_available_models", { error });
      return [];
    }
  }),

  downloadModel: authedProcedure
    .input(voiceDownloadInput)
    .mutation(async ({ input }) => {
      const provider = getVoiceProvider();
      if (provider !== "local") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "voice_provider_not_local",
        });
      }

      try {
        const scriptPath = join(
          process.cwd(),
          "packages/voice/scripts/download_voice.py"
        );
        const cmd = [
          "uv",
          "run",
          "python",
          scriptPath,
          "--voice",
          input.voiceId,
        ];

        const proc = Bun.spawn(cmd, {
          stdout: "pipe",
          stderr: "pipe",
          cwd: join(process.cwd(), "packages/voice"),
        });

        const output = await new Response(proc.stdout).text();
        const error = await new Response(proc.stderr).text();

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          // Try to parse error JSON from stderr if possible
          try {
            const errJson = JSON.parse(error);
            throw new Error(errJson.message || error);
          } catch {
            throw new Error(`Download failed: ${error || output}`);
          }
        }

        // Parse output to verify success
        try {
          // Output might be multiple JSON lines or just one
          // We look for the last line or search for "status": "success"
          if (!output.includes('"status": "success"')) {
            throw new Error("Download script did not report success");
          }
        } catch (e) {
          logger.warn("download_voice_output_parse_warn", { output, error: e });
        }

        // Invalidate local cache so the new voice shows up in listVoices
        voiceListCache = null;

        return { success: true };
      } catch (error) {
        logger.error("failed_to_download_model", {
          error,
          voiceId: input.voiceId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "failed_to_download_model",
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  listVoices: authedProcedure.query(async () => {
    const provider = getVoiceProvider();
    if (provider !== "local") {
      // For OpenAI, return standard voices
      return [
        { id: "alloy", name: "Alloy" },
        { id: "echo", name: "Echo" },
        { id: "fable", name: "Fable" },
        { id: "onyx", name: "Onyx" },
        { id: "nova", name: "Nova" },
        { id: "shimmer", name: "Shimmer" },
      ];
    }

    // Check cache
    if (
      voiceListCache &&
      Date.now() - voiceListCache.timestamp < VOICE_CACHE_TTL_MS
    ) {
      return voiceListCache.data;
    }

    const modelPath =
      process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";
    try {
      const files = await readdir(modelPath);
      const voices = files
        .filter((f) => f.endsWith(".onnx"))
        .map((f) => {
          const id = basename(f, ".onnx");
          return { id, name: id };
        });

      // Update cache
      voiceListCache = {
        data: voices,
        timestamp: Date.now(),
      };

      return voices;
    } catch (error) {
      logger.warn("failed_to_list_voices", { error });
      return [];
    }
  }),

  previewVoice: authedProcedure
    .input(voicePreviewInput)
    .mutation(async ({ input }) => {
      const provider = getVoiceProvider();
      if (provider === "local") {
        return synthesizeLocal({
          text: input.text,
          voice: input.voice,
          format: "mp3",
          model: "piper",
        });
      }
      return postSynthesis({
        text: input.text,
        voice: input.voice,
        format: "mp3",
        model: "gpt-4o-mini-tts",
      });
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
          } as any);
          voiceStreamEventsTotal.inc({ event: "status", status: "connected" });
          markVoice("voice_stream_connected");

          // Note: Actual audio chunk processing would happen via a separate mechanism
          // This is a basic implementation - full bidirectional streaming requires
          // accepting audio chunks via subscription input, which tRPC doesn't support natively
          // For now, this provides the connection status and structure

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
            sessionManager.removeSession(sessionId);
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
      });
    }),
});
