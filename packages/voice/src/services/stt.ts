import { performance } from "node:perf_hooks";
import { markVoice } from "@alfred/metrics/performance";
import {
  decodeToPCM16,
  isLikelyPCM,
  PCM_MIME_TYPE,
  sanitizeBase64,
} from "../audio/codec";
import { recordVoiceStt, voiceStreamLatencySeconds } from "../metrics";
import type { STTPool } from "../process/stt";

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
    recordVoiceStt({ provider: "maya1", status: "ok", durationSeconds });

    return {
      text: result.text,
      language: result.language ?? null,
      model: result.model ?? "faster-whisper-large-v3-turbo",
      provider: "maya1",
      durationSeconds,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_local_error");
    voiceStreamLatencySeconds.observe(
      { stage: "stt_transcribe" },
      durationSeconds
    );
    recordVoiceStt({ provider: "maya1", status: "error", durationSeconds });
    throw new Error(
      `local_transcription_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
