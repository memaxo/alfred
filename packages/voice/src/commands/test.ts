/**
 * Voice Test Commands
 *
 * CLI commands for testing STT/TTS functionality.
 */

import { Buffer } from "node:buffer";
import { extname, join } from "node:path";
import { decodeToPCM16, PCM_MIME_TYPE } from "../audio/codec";
import type { ProcessConfig } from "../process/stt";

// biome-ignore lint/suspicious/noConsole: CLI output
const log = console.log;

function guessMimeType(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".wav") {
    return "audio/wav";
  }
  if (ext === ".mp3") {
    return "audio/mpeg";
  }
  if (ext === ".ogg") {
    return "audio/ogg";
  }
  if (ext === ".opus") {
    return "audio/opus";
  }
  return "application/octet-stream";
}

function buildDefaultProcessConfig(kind: "stt" | "tts"): ProcessConfig {
  const whisperModelPath =
    process.env.WHISPER_MODEL_PATH ?? "./packages/voice/models/whisper";
  const piperModelPath =
    process.env.PIPER_MODEL_PATH ?? "./packages/voice/models/piper";

  const root = process.cwd().endsWith("packages/voice")
    ? process.cwd()
    : join(process.cwd(), "packages/voice");

  return {
    scriptPath: join(root, "python", kind),
    modelPath: kind === "stt" ? whisperModelPath : piperModelPath,
  };
}

/**
 * Test speech-to-text with an audio file
 */
export async function testSTT(args: { file?: string }): Promise<void> {
  const file = args.file ?? "test.wav";

  log(`Testing STT with file: ${file}`);

  try {
    const { STTPool } = await import("../process/stt");
    const pool = new STTPool(buildDefaultProcessConfig("stt"), 1);

    await pool.initialize();

    log("STT pool initialized, transcribing...");

    // Read file and transcribe
    const audioFile = Bun.file(file);
    if (!(await audioFile.exists())) {
      log(`Error: File not found: ${file}`);
      return;
    }

    const buffer = await audioFile.arrayBuffer();
    const mimeType = guessMimeType(file);
    const decoded = await decodeToPCM16({
      audioBase64: Buffer.from(buffer).toString("base64"),
      mimeType,
    });
    const result = await pool.transcribe({
      audioBase64: decoded.audioBase64,
      mimeType: decoded.mimeType,
    });

    log("Transcription result:");
    log(result);
  } catch (error) {
    log(`STT test failed: ${(error as Error).message}`);
  }
}

/**
 * Test text-to-speech with sample text
 */
export async function testTTS(args: { text?: string }): Promise<void> {
  const text =
    args.text ?? "Hello, this is a test of the text to speech system.";

  log(`Testing TTS with text: "${text}"`);

  try {
    const { TTSPool } = await import("../process/tts");
    const pool = new TTSPool(buildDefaultProcessConfig("tts"), 1);

    await pool.initialize();

    log("TTS pool initialized, synthesizing...");

    const chunk = await pool.synthesize({ text });
    const audioBuffer = Buffer.from(chunk.audioBase64, "base64");

    const sampleRate = chunk.sampleRate ?? 16_000;
    log(
      `Generated ${audioBuffer.byteLength} bytes of audio (${chunk.mimeType}, ${sampleRate} Hz)`
    );

    // Write to file
    const outFile =
      chunk.mimeType === PCM_MIME_TYPE ? "tts-output.pcm" : "tts-output.raw";
    await Bun.write(outFile, audioBuffer);
    log(`Audio written to: ${outFile}`);
  } catch (error) {
    log(`TTS test failed: ${(error as Error).message}`);
  }
}
