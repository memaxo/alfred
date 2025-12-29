/**
 * Voice Status Command
 *
 * Shows voice pipeline configuration and environment status.
 */

// biome-ignore lint/suspicious/noConsole: CLI output
const log = console.log;

type StatusResult = {
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
};

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

  // Output
  if (args.json) {
    log(JSON.stringify(result, null, 2));
  } else {
    log("\n🎤 Voice Pipeline Configuration\n");

    log("STT (Speech-to-Text):");
    log(`  Configured: ${result.stt.configured ? "✅" : "⚠️ (using defaults)"}`);
    log(`  Pool Size: ${result.stt.poolSize}`);
    log(`  Model: ${result.stt.env.VOICE_STT_MODEL || "(default)"}`);
    log(`  Device: ${result.stt.env.VOICE_STT_DEVICE || "(auto)"}`);

    log("\nTTS (Text-to-Speech):");
    log(`  Configured: ${result.tts.configured ? "✅" : "⚠️ (using defaults)"}`);
    log(`  Pool Size: ${result.tts.poolSize}`);
    log(`  Model: ${result.tts.env.VOICE_TTS_MODEL || "(default Maya1)"}`);
    log(`  Supertonic: ${result.tts.useSupertonic ? "enabled" : "disabled"}`);

    log("\nPython Runtime:");
    log(`  UV Enabled: ${result.python.useUv ? "✅" : "❌"}`);
    log(`  Path: ${result.python.path || "(auto-detect)"}`);

    log("");
  }

  return result;
}
