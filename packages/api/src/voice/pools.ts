import { STTPool, type ProcessConfig } from "@alfred/voice/process/stt_pool";
import { TTSPool } from "@alfred/voice/process/tts_pool";
import { VoiceSessionManager } from "./session";
import { join } from "node:path";
import { logger } from "../utils/logger";

// Re-export ProcessConfig for use in this package
export type { ProcessConfig };

let sttPool: STTPool | null = null;
let ttsPool: TTSPool | null = null;
let sessionManager: VoiceSessionManager | null = null;

export function getVoicePools(): {
  sttPool: STTPool;
  ttsPool: TTSPool;
  sessionManager: VoiceSessionManager;
} {
  if (!sttPool || !ttsPool || !sessionManager) {
    throw new Error("Voice pools not initialized. Call initializeVoicePools() first.");
  }
  return { sttPool, ttsPool, sessionManager };
}

export async function initializeVoicePools(): Promise<void> {
  if (sttPool || ttsPool) {
    console.warn("[voice] Voice pools already initialized, skipping re-initialization");
    return;
  }

  const voiceProvider = process.env.VOICE_PROVIDER ?? "openai";
  
  if (voiceProvider !== "local") {
    // OpenAI provider - pools not needed
    return;
  }

  const whisperModelPath = process.env.WHISPER_MODEL_PATH ?? "large-v3-turbo";
  const piperModelPath = process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";
  const sttPoolSize = parseInt(process.env.VOICE_STT_POOL_SIZE ?? "2", 10);
  const ttsPoolSize = parseInt(process.env.VOICE_TTS_POOL_SIZE ?? "2", 10);

  function getDefaultDevice(): string {
    if (process.platform === "darwin") {
      return "mps"; // Apple Silicon default
    }
    return "rocm"; // Linux default (AMD)
  }

  const sttConfig: ProcessConfig = {
    scriptPath: join(process.cwd(), "packages/voice/scripts/stt_server.py"),
    modelPath: whisperModelPath,
    device: process.env.WHISPER_DEVICE ?? getDefaultDevice(),
    computeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
  };

  // TTS now uses TypeScript implementation (no scriptPath needed)
  const ttsConfig: ProcessConfig = {
    scriptPath: "", // Not used for TypeScript TTS implementation
    modelPath: piperModelPath,
    voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
  };

  try {
    sttPool = new STTPool(sttConfig, sttPoolSize);
    ttsPool = new TTSPool(ttsConfig, ttsPoolSize);

    await sttPool.initialize();
    await ttsPool.initialize();

    sessionManager = new VoiceSessionManager(sttPool, ttsPool);

    // Start health monitoring loop
    setInterval(() => {
      if (sttPool) {
        // Check if pool is saturated
        const sttActive = sttPool.activeCount ?? 0;
        const sttSize = sttPool.size ?? 1;
        if (sttActive >= sttSize) {
          logger.warn("voice_pool_saturation", { pool: "stt", active: sttActive, size: sttSize });
        }
      }
      if (ttsPool) {
        const ttsActive = ttsPool.activeCount ?? 0;
        const ttsSize = ttsPool.size ?? 1;
        if (ttsActive >= ttsSize) {
          logger.warn("voice_pool_saturation", { pool: "tts", active: ttsActive, size: ttsSize });
        }
      }
    }, 15000).unref();

    console.log("[voice] Voice pools initialized");
  } catch (error) {
    console.error("[voice] Failed to initialize voice pools:", error);
    // Clean up partial initialization
    if (sttPool) {
      await sttPool.shutdown().catch(console.error);
      sttPool = null;
    }
    if (ttsPool) {
      await ttsPool.shutdown().catch(console.error);
      ttsPool = null;
    }
    throw error;
  }
}

export async function shutdownVoicePools(): Promise<void> {
  if (sessionManager) {
    sessionManager.shutdown();
    sessionManager = null;
  }
  if (sttPool) {
    await sttPool.shutdown();
    sttPool = null;
  }
  if (ttsPool) {
    await ttsPool.shutdown();
    ttsPool = null;
  }
}

