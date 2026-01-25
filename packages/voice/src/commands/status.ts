/**
 * Voice Status Command
 *
 * Shows voice pipeline configuration and environment status.
 */

import { logger } from "@alfred/logger";

interface StatusResult {
  stt: {
    configured: boolean;
    poolSize: number;
    env: Record<string, string | undefined>;
  };
  tts: {
    configured: boolean;
    poolSize: number;
    useSupertonic: boolean;
    env: Record<string, string | undefined>;
  };
  python: {
    useUv: boolean;
    path: string | undefined;
  };
}

/**
 * Show voice pipeline configuration status
 */
export function status(args: { json?: boolean }): StatusResult {
  const result: StatusResult = {
    stt: {
      configured: false,
      poolSize: Number(process.env.VOICE_STT_POOL_SIZE) || 2,
      env: {
        VOICE_STT_MODEL: process.env.VOICE_STT_MODEL,
        VOICE_STT_DEVICE: process.env.VOICE_STT_DEVICE,
        VOICE_STT_COMPUTE_TYPE: process.env.VOICE_STT_COMPUTE_TYPE,
      },
    },
    tts: {
      configured: false,
      poolSize: Number(process.env.VOICE_TTS_POOL_SIZE) || 2,
      useSupertonic: process.env.VOICE_USE_SUPERTONIC === "true",
      env: {
        VOICE_TTS_MODEL: process.env.VOICE_TTS_MODEL,
        VOICE_TTS_VOICE: process.env.VOICE_TTS_VOICE,
        VOICE_USE_SUPERTONIC: process.env.VOICE_USE_SUPERTONIC,
      },
    },
    python: {
      useUv: process.env.VOICE_USE_UV !== "false",
      path: process.env.VOICE_PYTHON_PATH,
    },
  };

  // Check if STT is configured
  result.stt.configured = !!(
    result.stt.env.VOICE_STT_MODEL || result.stt.poolSize > 0
  );

  // Check if TTS is configured
  result.tts.configured = !!(
    result.tts.env.VOICE_TTS_MODEL ||
    result.tts.useSupertonic ||
    result.tts.poolSize > 0
  );

  logger.info("voice_status", {
    out: args.json ? "json" : "pretty",
    ...result,
  });

  return result;
}
