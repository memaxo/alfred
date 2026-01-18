import { performance } from "node:perf_hooks";
import { markVoice } from "@alfred/metrics/performance";
import {
  decodeToPCM16,
  isLikelyPCM,
  PCM_MIME_TYPE,
  sanitizeBase64,
} from "../audio/codec";
import { recordVoiceStt, voiceStreamLatencySeconds } from "../metrics";
import type { ChunkSize, STTPool } from "../process/stt";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MiB cap

export type SttInput = {
  audioBase64: string;
  mimeType: string;
  model: string;
  language?: string;
  prompt?: string;
};

export type SttStreamingInput = SttInput & {
  sessionId: string;
  chunkSize?: ChunkSize;
  clearCache?: boolean;
};

export async function normalizeLocalSttAudio(input: SttInput) {
  const sanitized = sanitizeBase64(input.audioBase64);
  if (!sanitized) {
    throw new Error("audio_payload_empty");
  }

  // Validate audio size before processing
  const estimatedBytes = Math.ceil((sanitized.length * 3) / 4);
  if (estimatedBytes > MAX_AUDIO_BYTES) {
    throw new Error(
      `audio_payload_too_large: ${estimatedBytes} bytes exceeds ${MAX_AUDIO_BYTES} byte limit`
    );
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
    recordVoiceStt({ provider: "nemotron", status: "ok", durationSeconds });

    return {
      text: result.text,
      language: result.language ?? null,
      model: result.model ?? "nvidia/nemotron-speech-streaming-en-0.6b",
      provider: "nemotron",
      durationSeconds,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_local_error");
    voiceStreamLatencySeconds.observe(
      { stage: "stt_transcribe" },
      durationSeconds
    );
    recordVoiceStt({ provider: "nemotron", status: "error", durationSeconds });
    throw new Error(
      `local_transcription_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Transcribe audio using cache-aware streaming for real-time feedback.
 *
 * This leverages Nemotron's streaming mode which maintains state across
 * chunks for the same session, enabling lower latency and progressive output.
 *
 * Key features:
 * - Session affinity: Requests with the same sessionId use the same worker process
 * - Cache-aware: Nemotron maintains decoder state between chunks
 * - Partial results: Returns isPartial=true for intermediate transcriptions
 * - Chunk size control: Trade latency vs accuracy with chunkSize parameter
 */
export async function transcribeStreaming(
  pool: STTPool,
  input: SttStreamingInput
): Promise<{
  text: string;
  isPartial: boolean;
  language: string | null;
  model: string;
  provider: string;
  durationSeconds: number;
  streamingEnabled: boolean;
}> {
  const timerStart = performance.now();
  markVoice("stt_streaming_start");

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
      streaming: true,
      sessionId: input.sessionId,
      chunkSize: input.chunkSize,
      clearCache: input.clearCache,
    });

    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_streaming_complete");
    voiceStreamLatencySeconds.observe(
      { stage: "stt_streaming" },
      durationSeconds
    );
    recordVoiceStt({ provider: "nemotron", status: "ok", durationSeconds });

    return {
      text: result.text,
      isPartial: result.isPartial ?? false,
      language: result.language ?? null,
      model: result.model ?? "nvidia/nemotron-speech-streaming-en-0.6b",
      provider: "nemotron",
      durationSeconds,
      streamingEnabled: result.streamingEnabled ?? true,
    };
  } catch (error) {
    const durationSeconds = (performance.now() - timerStart) / 1000;
    markVoice("stt_streaming_error");
    voiceStreamLatencySeconds.observe(
      { stage: "stt_streaming" },
      durationSeconds
    );
    recordVoiceStt({ provider: "nemotron", status: "error", durationSeconds });
    throw new Error(
      `streaming_transcription_failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Clear the streaming cache for a session.
 * Call this when starting a new utterance within the same session.
 */
export async function clearStreamingCache(
  pool: STTPool,
  sessionId: string
): Promise<boolean> {
  return pool.clearSessionCache(sessionId);
}

/**
 * Release session affinity.
 * Call this when a voice session ends to free up resources.
 */
export function releaseStreamingSession(
  pool: STTPool,
  sessionId: string
): void {
  pool.releaseSession(sessionId);
}

/**
 * Get session info for debugging/monitoring.
 */
export function getStreamingSessionInfo(
  pool: STTPool,
  sessionId: string
): { hasAffinity: boolean; processIndex?: number } {
  return pool.getSessionInfo(sessionId);
}
