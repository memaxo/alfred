import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import type { TTSPool } from "../process/tts";
import { encodeFromPCM16, sanitizeBase64 } from "../audio/codec";
import { recordVoiceTts, voiceStreamLatencySeconds } from "../metrics";
import { requireOpenAIConfig } from "./config";

export type TtsInput = {
  text: string;
  voice: string;
  format: "mp3" | "opus" | "wav";
  model: string;
};

export function formatToMime(format: TtsInput["format"]) {
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

export async function encodeLocalTtsAudio(
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
    throw new Error(
      `local_codec_encode_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function synthesizeLocal(
  pool: TTSPool,
  input: TtsInput
): Promise<{
  audioBase64: string;
  mimeType: string;
  model: string;
  provider: string;
  durationSeconds: number;
}> {
  const timerStart = performance.now();
  markVoice("tts_local_start");

  // Backpressure check
  if (pool.activeCount >= pool.size) {
    throw new Error("voice_tts_pool_saturated");
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

    const result = await pool.synthesize({
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
    throw new Error(
      `local_synthesis_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function postSynthesis(input: TtsInput) {
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
    throw new Error(
      `openai_synthesis_network_error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
    throw new Error(
      `openai_synthesis_failed: ${JSON.stringify(errorPayload)}`
    );
  }

  const audioBuffer = await response.arrayBuffer();
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    recordVoiceTts({
      provider: providerLabel,
      status: "error",
      durationSeconds,
    });
    throw new Error("openai_synthesis_empty");
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
