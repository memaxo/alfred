import { markVoice } from "@alfred/metrics/performance";
import { performance } from "node:perf_hooks";

import type { TTSPool } from "../process/tts";

import { encodeFromPCM16, sanitizeBase64 } from "../audio/codec";
import { recordVoiceTts, voiceStreamLatencySeconds } from "../metrics";

export interface TtsInput {
  text: string;
  voice: string;
  format: "mp3" | "opus" | "wav";
  model: string;
}

export function formatToMime(format: TtsInput["format"]) {
  switch (format) {
    case "mp3": {
      return "audio/mpeg";
    }
    case "opus": {
      return "audio/ogg";
    }
    case "wav": {
      return "audio/wav";
    }
    default: {
      return "audio/mpeg";
    }
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
      }`,
      { cause: error }
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
    recordVoiceTts({ provider: "maya1", status: "ok", durationSeconds });

    return {
      audioBase64: encoded.audioBase64,
      mimeType: encoded.mimeType,
      model: input.voice ?? "piper",
      provider: "maya1",
      durationSeconds,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("tts_local_error");
    voiceStreamLatencySeconds.observe(
      { stage: "tts_synthesize" },
      durationSeconds
    );
    recordVoiceTts({ provider: "maya1", status: "error", durationSeconds });
    throw new Error(
      `local_synthesis_failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}
