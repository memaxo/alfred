import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { logger } from "@alfred/logger";

// Simple in-memory cache for available voices (remote)
let availableVoiceCache: { data: unknown[]; timestamp: number } | null = null;
const AVAILABLE_VOICE_CACHE_TTL_MS = 3600 * 1000; // 1 hour

// Simple in-memory cache for voice list (local)
let voiceListCache: {
  data: { id: string; name: string }[];
  timestamp: number;
} | null = null;
const VOICE_CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function listAvailableModels() {
  if (
    availableVoiceCache &&
    Date.now() - availableVoiceCache.timestamp < AVAILABLE_VOICE_CACHE_TTL_MS
  ) {
    return availableVoiceCache.data;
  }

  try {
    const scriptPath = join(
      process.cwd(),
      "packages/voice/scripts/list_available_voices.py"
    );
    const cmd = ["uv", "run", "python", scriptPath];

    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: join(process.cwd(), "packages/voice"),
    });

    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();

    if (error && error.trim().length > 0) {
      logger.debug("list_available_voices_stderr", { stderr: error });
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Script exited with code ${exitCode}: ${error}`);
    }

    const voices = JSON.parse(output);
    availableVoiceCache = {
      data: voices,
      timestamp: Date.now(),
    };

    return voices;
  } catch (error) {
    logger.warn("failed_to_list_available_models", { error });
    return [];
  }
}

export async function downloadModel(voiceId: string) {
  try {
    const scriptPath = join(
      process.cwd(),
      "packages/voice/scripts/download_voice.py"
    );
    const cmd = ["uv", "run", "python", scriptPath, "--voice", voiceId];

    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: join(process.cwd(), "packages/voice"),
    });

    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      try {
        const errJson = JSON.parse(error);
        throw new Error(errJson.message || error);
      } catch {
        throw new Error(`Download failed: ${error || output}`);
      }
    }

    if (!output.includes('"status": "success"')) {
      throw new Error("Download script did not report success");
    }

    // Invalidate local cache
    voiceListCache = null;

    return { success: true };
  } catch (error) {
    logger.error("failed_to_download_model", {
      error,
      voiceId,
    });
    throw new Error(
      `failed_to_download_model: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function listVoices() {
  if (process.env.TTS_PROVIDER === "supertonic") {
    return [
      { id: "M1", name: "Male 1" },
      { id: "M2", name: "Male 2" },
      { id: "F1", name: "Female 1" },
      { id: "F2", name: "Female 2" },
    ];
  }

  if (
    voiceListCache &&
    Date.now() - voiceListCache.timestamp < VOICE_CACHE_TTL_MS
  ) {
    return voiceListCache.data;
  }

  const modelPath =
    process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";
  try {
    const files = await readdir(modelPath);
    const voices = files
      .filter((f) => f.endsWith(".onnx"))
      .map((f) => {
        const id = basename(f, ".onnx");
        return { id, name: id };
      });

    voiceListCache = {
      data: voices,
      timestamp: Date.now(),
    };

    return voices;
  } catch (error) {
    logger.warn("failed_to_list_voices", { error });
    return [];
  }
}
