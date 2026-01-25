import { logger } from "@alfred/logger";
import { join } from "node:path";

import { VoiceRegistry } from "../server/registry";
import { resolveVoiceDir } from "./base";
import { type ProcessConfig as STTConfig, STTPool } from "./stt";
import { type ProcessConfig as TTSConfig, TTSPool } from "./tts";

const voiceDir = resolveVoiceDir();

let sttPool: STTPool | null = null;
let ttsPool: TTSPool | null = null;
let voiceRegistry: VoiceRegistry | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

export function getVoicePools() {
  if (!(sttPool && ttsPool && voiceRegistry)) {
    throw new Error("voice_pools_not_initialized");
  }
  return {
    sttPool,
    ttsPool,
    voiceRegistry,
    sessionManager: voiceRegistry,
  };
}

export function isVoiceInitialized() {
  return initialized;
}

export async function initializeVoicePools() {
  if (initialized) {
    return;
  }
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      const sttPoolSize = Number.parseInt(
        process.env.VOICE_STT_POOL_SIZE ?? "2",
        10
      );
      const ttsPoolSize = Number.parseInt(
        process.env.VOICE_TTS_POOL_SIZE ?? "1",
        10
      );

      const sttConfig: STTConfig = {
        scriptPath: join(voiceDir, "python/stt"),
        modelPath:
          process.env.WHISPER_MODEL_PATH ??
          "nvidia/parakeet_realtime_eou_120m-v1",
        device:
          process.env.WHISPER_DEVICE ??
          (process.platform === "darwin" ? "mps" : "rocm"),
        computeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
      };

      const ttsConfig: TTSConfig = {
        scriptPath: join(voiceDir, "python/tts"),
        modelPath:
          process.env.PIPER_MODEL_PATH ?? join(voiceDir, "models/piper"),
        voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
      };

      sttPool = new STTPool(sttConfig, sttPoolSize);
      ttsPool = new TTSPool(ttsConfig, ttsPoolSize);

      await sttPool.initialize();
      try {
        await ttsPool.initialize();
      } catch (error) {
        logger.error("tts_pool_init_failed", { error: error });
      }

      voiceRegistry = new VoiceRegistry(sttPool, ttsPool);
      initialized = true;
    } catch (error) {
      await shutdownVoicePools().catch(() => {});
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

export async function shutdownVoicePools() {
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
  initialized = false;
}
