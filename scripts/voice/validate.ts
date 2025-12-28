#!/usr/bin/env bun

/**
 * Voice Validation Script (macOS-friendly)
 *
 * Validates:
 * - Explicit pool init (no auto-init assumptions)
 * - STT correctness + cold/warm latency (using `transcribeLocal`)
 * - TTS correctness + cold/warm latency (using `synthesizeLocal`)
 *
 * Usage:
 *   VOICE_PROVIDER=maya1 WHISPER_DEVICE=mps ALFRED_API_AUTO_INIT=false bun scripts/voice/validate.ts
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "bun";
import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../../packages/api/src/voice/pools";
import { transcribeLocal } from "../../packages/voice/src/services/stt";
import { synthesizeLocal } from "../../packages/voice/src/services/tts";

const SAY_TEXT = "Hello Alfred.";

async function spawnOk(cmd: string[], cwd?: string) {
  const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe", cwd });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (code !== 0) {
    throw new Error(
      "cmd_failed: " +
        cmd.join(" ") +
        " code=" +
        code +
        " stderr=" +
        stderr.trim() +
        " stdout=" +
        stdout.trim()
    );
  }
  return { stdout, stderr };
}

async function makeSpeechWav(outPath: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("speech_fixture_requires_macos");
  }

  const aiffPath = outPath.replace(/\.wav$/u, ".aiff");

  await spawnOk(["say", "-o", aiffPath, SAY_TEXT]);
  await spawnOk([
    "afconvert",
    "-f",
    "WAVE",
    "-d",
    "LEI16@16000",
    "-c",
    "1",
    aiffPath,
    outPath,
  ]);
}

function parseArgs(argv: string[]) {
  let inputPath: string | null = null;
  let noSay = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) {
      continue;
    }
    if (a === "--input") {
      const v = argv[i + 1];
      if (!v) {
        throw new Error("--input requires a path");
      }
      inputPath = v;
      i++;
      continue;
    }
    if (a === "--no-say") {
      noSay = true;
    }
  }
  return { inputPath, noSay };
}

async function resolveInputWav(
  tmpDir: string,
  noSay: boolean
): Promise<string> {
  const generated = join(tmpDir, "say.wav");
  if (!noSay && process.platform === "darwin") {
    try {
      await makeSpeechWav(generated);
      return generated;
    } catch (error) {
      console.warn(
        "say_fixture_failed_falling_back",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  {
    const fallback = join(process.cwd(), "scripts/fixtures/hello.wav");
    if (!existsSync(fallback)) {
      throw new Error("no_audio_fixture_available");
    }
    return fallback;
  }
}

async function main() {
  const { inputPath, noSay } = parseArgs(process.argv.slice(2));
  const voiceProvider = (process.env.VOICE_PROVIDER ?? "maya1").toLowerCase();
  if (voiceProvider !== "maya1") {
    throw new Error("VOICE_PROVIDER must be maya1 for this validator");
  }

  const tmpDir = join(process.cwd(), "tmp", "voice");
  await mkdir(tmpDir, { recursive: true });

  const wavPath = inputPath ?? (await resolveInputWav(tmpDir, noSay));
  const wav = await readFile(wavPath);
  const audioBase64 = wav.toString("base64");

  console.log("voice_validate_env", {
    VOICE_PROVIDER: process.env.VOICE_PROVIDER,
    WHISPER_DEVICE: process.env.WHISPER_DEVICE,
    VOICE_STT_POOL_SIZE: process.env.VOICE_STT_POOL_SIZE,
    VOICE_TTS_POOL_SIZE: process.env.VOICE_TTS_POOL_SIZE,
    inputWav: wavPath,
    wavBytes: wav.byteLength,
  });

  const t0 = performance.now();
  await initializeVoicePools();
  const initMs = performance.now() - t0;
  console.log("voice_pools_init_ms", Math.round(initMs));

  const { sttPool, ttsPool } = getVoicePools();

  const t1 = performance.now();
  const stt1 = await transcribeLocal(sttPool, {
    audioBase64,
    mimeType: "audio/wav",
    model:
      process.env.WHISPER_MODEL_PATH ?? "nvidia/parakeet_realtime_eou_120m-v1",
    language: "en",
  });
  const stt1Ms = performance.now() - t1;
  console.log(
    "stt_cold_ms",
    Math.round(stt1Ms),
    "text",
    JSON.stringify(stt1.text)
  );
  if (!stt1.text.trim()) {
    throw new Error("stt_empty_transcript");
  }

  const t2 = performance.now();
  const stt2 = await transcribeLocal(sttPool, {
    audioBase64,
    mimeType: "audio/wav",
    model:
      process.env.WHISPER_MODEL_PATH ?? "nvidia/parakeet_realtime_eou_120m-v1",
    language: "en",
  });
  const stt2Ms = performance.now() - t2;
  console.log(
    "stt_warm_ms",
    Math.round(stt2Ms),
    "text",
    JSON.stringify(stt2.text)
  );

  const phrase = `I heard: ${stt1.text}.`;

  const t3 = performance.now();
  const tts1 = await synthesizeLocal(ttsPool, {
    text: phrase,
    voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
    format: "wav",
    model: process.env.TTS_MODEL ?? "maya1",
  });
  const tts1Ms = performance.now() - t3;
  console.log(
    "tts_cold_ms",
    Math.round(tts1Ms),
    "mime",
    tts1.mimeType,
    "b64_len",
    tts1.audioBase64.length
  );

  const outWav = join(tmpDir, "tts.wav");
  await writeFile(outWav, Buffer.from(tts1.audioBase64, "base64"));
  console.log("tts_saved", outWav);

  const t4 = performance.now();
  const tts2 = await synthesizeLocal(ttsPool, {
    text: phrase,
    voice: process.env.PIPER_VOICE ?? "en_US-lessac-medium",
    format: "wav",
    model: process.env.TTS_MODEL ?? "maya1",
  });
  const tts2Ms = performance.now() - t4;
  console.log(
    "tts_warm_ms",
    Math.round(tts2Ms),
    "mime",
    tts2.mimeType,
    "b64_len",
    tts2.audioBase64.length
  );

  await shutdownVoicePools();
  console.log("voice_pools_shutdown_ok");
}

main().catch(async (error) => {
  try {
    await shutdownVoicePools();
  } catch {}
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
