import { join } from "node:path";
import { logger } from "@alfred/logger";
import { type ProcessConfig, STTPool } from "@alfred/voice/process/stt";
import { TTSPool } from "@alfred/voice/process/tts";
import { VoiceRegistry } from "./session";

// Re-export ProcessConfig for use in this package
export type { ProcessConfig };

let sttPool: STTPool | null = null;
let ttsPool: TTSPool | null = null;
let voiceRegistry: VoiceRegistry | null = null;
let initPromise: Promise<void> | null = null;
let initialized = false;

export function getVoicePools(): {
  sttPool: STTPool;
  ttsPool: TTSPool;
  voiceRegistry: VoiceRegistry;
  sessionManager: VoiceRegistry;
} {
  if (!(sttPool && ttsPool && voiceRegistry)) {
    throw new Error(
      "Voice pools not initialized. Call initializeVoicePools() first."
    );
  }
  return {
    sttPool,
    ttsPool,
    voiceRegistry,
    sessionManager: voiceRegistry,
  };
}

export async function initializeVoicePools(): Promise<void> {
  if (initialized) {
    return;
  }
  if (initPromise) {
    await initPromise;
    return;
  }

  const rawProvider = (process.env.VOICE_PROVIDER ?? "maya1").toLowerCase();
  const voiceProvider = rawProvider === "supertonic" ? "supertonic" : "maya1";
  process.env.VOICE_PROVIDER = voiceProvider;

  if (voiceProvider === "supertonic") {
    process.env.TTS_PROVIDER = "supertonic";
  } else if (!process.env.TTS_PROVIDER) {
    process.env.TTS_PROVIDER = "maya1";
  }

  const whisperModelPath =
    process.env.WHISPER_MODEL_PATH ?? "nvidia/parakeet_realtime_eou_120m-v1";
  const piperModelPath =
    process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";
  const sttPoolSize = Number.parseInt(
    process.env.VOICE_STT_POOL_SIZE ?? "2",
    10
  );
  const ttsPoolSize = Number.parseInt(
    process.env.VOICE_TTS_POOL_SIZE ?? "1", // Default to 1 for Maya1 (heavy model)
    10
  );

  function getDefaultDevice(): string {
    if (process.platform === "darwin") {
      return "mps"; // Apple Silicon default
    }
    return "rocm"; // Linux default (AMD)
  }

  const sttConfig: ProcessConfig = {
    // Point to the python/stt package (which has __main__.py)
    // When running with uv, we want "python -m stt" ideally, or "python python/stt"
    scriptPath: join(process.cwd(), "packages/voice/python/stt"),
    modelPath: whisperModelPath,
    device: process.env.WHISPER_DEVICE ?? getDefaultDevice(),
    computeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
  };

  // TTS Provider Selection
  // Default to maya1 if not specified, unless TTS_PROVIDER env var is set
  // Note: TTSPool constructor now checks TTS_PROVIDER env var directly.

  const ttsConfig: ProcessConfig = {
    scriptPath: join(process.cwd(), "packages/voice/python/tts"),
    modelPath: piperModelPath, // Ignored by Maya1 (uses HF), but kept for type compatibility
    voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium", // Will be used as description default if not provided in request
  };

  initPromise = (async () => {
    try {
      sttPool = new STTPool(sttConfig, sttPoolSize);
      ttsPool = new TTSPool(ttsConfig, ttsPoolSize);

      await sttPool.initialize();
      try {
        await ttsPool.initialize();
      } catch (error) {
        logger.error("tts_pool_init_failed", { error });
        // Don't fail the whole system if TTS fails, as STT might be the priority for testing
      }

      voiceRegistry = new VoiceRegistry(sttPool, ttsPool);

      // Start health monitoring loop
      setInterval(() => {
        if (sttPool) {
          // Check if pool is saturated
          const sttActive = sttPool.activeCount ?? 0;
          const sttSize = sttPool.size ?? 1;
          if (sttActive >= sttSize) {
            logger.warn("voice_pool_saturation", {
              pool: "stt",
              active: sttActive,
              size: sttSize,
            });
          }
        }
        if (ttsPool) {
          const ttsActive = ttsPool.activeCount ?? 0;
          const ttsSize = ttsPool.size ?? 1;
          if (ttsActive >= ttsSize) {
            logger.warn("voice_pool_saturation", {
              pool: "tts",
              active: ttsActive,
              size: ttsSize,
            });
          }
        }
      }, 15_000).unref();

      initialized = true;
    } catch (error) {
      // Clean up partial initialization
      if (voiceRegistry) {
        voiceRegistry.shutdown();
        voiceRegistry = null;
      }
      if (sttPool) {
        await sttPool.shutdown().catch(() => {});
        sttPool = null;
      }
      if (ttsPool) {
        await ttsPool.shutdown().catch(() => {});
        ttsPool = null;
      }
      throw error;
    }
  })();

  try {
    await initPromise;
  } finally {
    if (!initialized) {
      initPromise = null;
    }
  }
}

export async function shutdownVoicePools(): Promise<void> {
  if (voiceRegistry) {
    voiceRegistry.shutdown();
    voiceRegistry = null;
  }
  if (sttPool) {
    await sttPool.shutdown();
    sttPool = null;
  }
  if (ttsPool) {
    await ttsPool.shutdown();
    ttsPool = null;
  }
  initPromise = null;
  initialized = false;
}
