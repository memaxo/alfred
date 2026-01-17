import type { ChunkSize } from "../process/stt";

/**
 * Default STT model - Nemotron Speech Streaming for maximum accuracy.
 * 600M parameter model with native punctuation and cache-aware streaming.
 */
export const DEFAULT_STT_MODEL =
  process.env.VOICE_STT_MODEL ?? "nvidia/nemotron-speech-streaming-en-0.6b";

/**
 * Default TTS model - Maya1 for high-quality voice synthesis.
 */
export const DEFAULT_TTS_MODEL = process.env.VOICE_TTS_MODEL ?? "maya1";

/**
 * Default TTS voice.
 */
export const DEFAULT_TTS_VOICE =
  process.env.VOICE_TTS_VOICE ?? "en_US-lessac-medium";

/**
 * Default STT chunk size for latency/accuracy tradeoff.
 * - "fast": 80ms chunks, lowest latency
 * - "low": 160ms chunks
 * - "medium": 560ms chunks, balanced (default)
 * - "accurate": 1.12s chunks, highest accuracy
 */
export const DEFAULT_STT_CHUNK_SIZE: ChunkSize =
  (process.env.VOICE_STT_CHUNK_SIZE as ChunkSize) ?? "medium";

/**
 * Validate chunk size value.
 */
export function isValidChunkSize(value: unknown): value is ChunkSize {
  return (
    typeof value === "string" &&
    ["fast", "low", "medium", "accurate"].includes(value)
  );
}

/**
 * Get STT chunk size from environment or default.
 */
export function getSttChunkSize(): ChunkSize {
  const envValue = process.env.VOICE_STT_CHUNK_SIZE;
  if (envValue && isValidChunkSize(envValue)) {
    return envValue;
  }
  return "medium";
}

export function getVoiceProvider(): "maya1" | "supertonic" {
  const raw = (process.env.VOICE_PROVIDER ?? "maya1").toLowerCase();
  return raw === "supertonic" ? "supertonic" : "maya1";
}

export async function resolveVoicePreference(
  userId: string,
  requestedVoice: string
): Promise<string> {
  // Only override if the requested voice is the default
  if (requestedVoice !== DEFAULT_TTS_VOICE) {
    return requestedVoice;
  }

  try {
    const userModule = await import("@alfred/db/repo/user");
    const prefs = await userModule.getPreferences(userId);
    const voicePref = Array.isArray(prefs)
      ? prefs.find(
          (p: { key: string; value: unknown }) => p.key === "voice.tts"
        )
      : null;

    if (voicePref?.value && typeof voicePref.value === "string") {
      return voicePref.value;
    }
  } catch (error) {
    try {
      const loggerModule = await import("@alfred/logger");
      loggerModule.logger.warn("failed_to_resolve_voice_preference", {
        userId,
        error,
      });
    } catch {
      // Ignore logger load failure
    }
  }

  return requestedVoice;
}

export async function resolveSttLanguagePreference(
  userId: string,
  requestedLanguage?: string
): Promise<string | undefined> {
  if (requestedLanguage) {
    return requestedLanguage;
  }

  try {
    const userModule = await import("@alfred/db/repo/user");
    const prefs = await userModule.getPreferences(userId);
    const langPref = Array.isArray(prefs)
      ? prefs.find(
          (p: { key: string; value: unknown }) => p.key === "voice.stt.language"
        )
      : null;

    if (langPref?.value && typeof langPref.value === "string") {
      return langPref.value;
    }
  } catch (error) {
    try {
      const loggerModule = await import("@alfred/logger");
      loggerModule.logger.warn("failed_to_resolve_stt_preference", {
        userId,
        error,
      });
    } catch {
      // Ignore logger load failure
    }
  }

  return;
}

/**
 * Resolve STT chunk size preference for a user.
 */
export async function resolveSttChunkSizePreference(
  userId: string,
  requestedChunkSize?: ChunkSize
): Promise<ChunkSize> {
  // Use requested if provided
  if (requestedChunkSize && isValidChunkSize(requestedChunkSize)) {
    return requestedChunkSize;
  }

  try {
    const userModule = await import("@alfred/db/repo/user");
    const prefs = await userModule.getPreferences(userId);
    const chunkPref = Array.isArray(prefs)
      ? prefs.find(
          (p: { key: string; value: unknown }) =>
            p.key === "voice.stt.chunk_size"
        )
      : null;

    if (chunkPref?.value && isValidChunkSize(chunkPref.value)) {
      return chunkPref.value;
    }
  } catch {
    // Ignore preference lookup failure
  }

  return DEFAULT_STT_CHUNK_SIZE;
}
