import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import {
  decodeToPCM16,
  inferExtension,
  isLikelyPCM,
  PCM_MIME_TYPE,
  sanitizeBase64,
} from "../audio/codec";
import { recordVoiceStt, voiceStreamLatencySeconds } from "../metrics";
import type { STTPool } from "../process/stt";
import { requireOpenAIConfig } from "./config";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MiB cap

export type SttInput = {
  audioBase64: string;
  mimeType: string;
  model: string;
  language?: string;
  prompt?: string;
};

export async function normalizeLocalSttAudio(input: SttInput) {
  const sanitized = sanitizeBase64(input.audioBase64);
  if (!sanitized) {
    throw new Error("audio_payload_empty");
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
    throw new Error(
      `local_codec_decode_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function transcribeLocal(
  pool: STTPool,
  input: SttInput
): Promise<{
  text: string;
  language: string | null;
  model: string;
  provider: string;
  durationSeconds: number;
}> {
  const timerStart = performance.now();
  markVoice("stt_local_start");

  // Backpressure check
  if (pool.activeCount >= pool.size) {
    throw new Error("voice_stt_pool_saturated");
  }

  try {
    const normalized = await normalizeLocalSttAudio(input);
    const result = await pool.transcribe({
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
    throw new Error(
      `local_transcription_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function postTranscription(input: SttInput) {
  const { apiKey, baseUrl } = requireOpenAIConfig();
  const cleaned = sanitizeBase64(input.audioBase64);
  const audioBuffer = Buffer.from(cleaned, "base64");
  if (audioBuffer.byteLength === 0) {
    throw new Error("audio_payload_empty");
  }
  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("audio_payload_too_large");
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
    throw new Error(
      `openai_transcription_network_error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
    throw new Error(
      `openai_transcription_failed: ${JSON.stringify(errorPayload)}`
    );
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
    throw new Error("openai_transcription_empty");
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
