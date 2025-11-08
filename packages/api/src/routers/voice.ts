import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import type { Response } from "undici";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { recordVoiceStt, recordVoiceTts } from "../metrics";
import { authedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";

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

const voiceStreamInput = z
  .object({
    mode: z.enum(["clip", "stream"]).default("stream"),
  })
  .partial();

type SttInput = z.infer<typeof sttInput>;
type TtsInput = z.infer<typeof ttsInput>;

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
    // JSON parsing failed, try text instead
    // Logged at debug level as this is expected fallback behavior
    logger.debug("error_response_json_parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    return await response.text();
  } catch (error) {
    // Text parsing also failed - log and return null
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
    .mutation(async ({ input }) => postTranscription(input)),

  ttsSynthesize: authedProcedure
    .use(requirePolicy("voice.tts", toTtsResource))
    .input(ttsInput)
    .mutation(async ({ input }) => postSynthesis(input)),

  stream: authedProcedure.input(voiceStreamInput.optional()).subscription(() =>
    observable<{ type: "noop" }>((emit) => {
      emit.next({ type: "noop" });
      emit.complete();
      return () => {};
    })
  ),
});
