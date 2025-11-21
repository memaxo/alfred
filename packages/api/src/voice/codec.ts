import { Buffer } from "node:buffer";

const PCM_SAMPLE_RATE = 16000;
const PCM_CHANNELS = 1;
const PCM_BIT_DEPTH = 16;
export const PCM_MIME_TYPE = "audio/raw;codec=pcm_s16le;rate=16000";

const DEFAULT_BITRATES: Record<TargetFormat, string> = {
  mp3: "96k",
  opus: "48k",
  wav: "256k",
};

export type TargetFormat = "mp3" | "opus" | "wav";

let ffmpegChecked = false;
let ffmpegError: Error | null = null;

export function ensureFfmpegAvailable(): void {
  if (ffmpegChecked) {
    if (ffmpegError) {
      throw ffmpegError;
    }
    return;
  }
  ffmpegChecked = true;
  try {
    runFfmpeg(["-version"]);
  } catch (error) {
    ffmpegError =
      error instanceof Error
        ? error
        : new Error(`ffmpeg_check_failed: ${String(error)}`);
    throw ffmpegError;
  }
}

export interface DecodeRequest {
  audioBase64: string;
  mimeType: string;
}

export interface DecodeResult {
  audioBase64: string;
  mimeType: typeof PCM_MIME_TYPE;
  sampleRate: number;
  channels: number;
}

export async function decodeToPCM16({
  audioBase64,
  mimeType,
}: DecodeRequest): Promise<DecodeResult> {
  ensureFfmpegAvailable();
  const cleaned = stripBase64Prefix(audioBase64);
  const inputBuffer = Buffer.from(cleaned, "base64");
  if (inputBuffer.byteLength === 0) {
    throw new Error("audio_payload_empty");
  }

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "pipe:0",
    "-ac",
    String(PCM_CHANNELS),
    "-ar",
    String(PCM_SAMPLE_RATE),
    "-map_metadata",
    "-1",
    "-vn",
    "-f",
    "s16le",
    "pipe:1",
  ];

  const stdout = runFfmpeg(args, inputBuffer);
  if (stdout.byteLength === 0) {
    throw new Error("ffmpeg_decode_empty_output");
  }

  return {
    audioBase64: Buffer.from(stdout).toString("base64"),
    mimeType: PCM_MIME_TYPE,
    sampleRate: PCM_SAMPLE_RATE,
    channels: PCM_CHANNELS,
  };
}

export interface EncodeRequest {
  audioBase64: string;
  format: TargetFormat;
  bitrate?: string;
}

export interface EncodeResult {
  audioBase64: string;
  mimeType: string;
  format: TargetFormat;
}

export async function encodeFromPCM16({
  audioBase64,
  format,
  bitrate,
}: EncodeRequest): Promise<EncodeResult> {
  ensureFfmpegAvailable();
  const cleaned = stripBase64Prefix(audioBase64);
  const inputBuffer = Buffer.from(cleaned, "base64");
  if (inputBuffer.byteLength === 0) {
    throw new Error("audio_payload_empty");
  }

  const target = resolveFormatConfig(format, bitrate);
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "s16le",
    "-ac",
    String(PCM_CHANNELS),
    "-ar",
    String(PCM_SAMPLE_RATE),
    "-i",
    "pipe:0",
    ...target.codecArgs,
    "-map_metadata",
    "-1",
    "-vn",
    "-f",
    target.container,
    "pipe:1",
  ];

  const stdout = runFfmpeg(args, inputBuffer);
  if (stdout.byteLength === 0) {
    throw new Error("ffmpeg_encode_empty_output");
  }

  return {
    audioBase64: Buffer.from(stdout).toString("base64"),
    mimeType: target.mimeType,
    format,
  };
}

function resolveFormatConfig(format: TargetFormat, bitrate?: string) {
  switch (format) {
    case "mp3":
      return {
        container: "mp3",
        mimeType: "audio/mpeg",
        codecArgs: ["-codec:a", "libmp3lame", "-b:a", bitrate ?? DEFAULT_BITRATES.mp3],
      };
    case "opus":
      return {
        container: "ogg",
        mimeType: "audio/ogg;codecs=opus",
        codecArgs: ["-codec:a", "libopus", "-b:a", bitrate ?? DEFAULT_BITRATES.opus],
      };
    case "wav":
      return {
        container: "wav",
        mimeType: "audio/wav",
        codecArgs: ["-codec:a", "pcm_s16le"],
      };
    default: {
      const exhaustive: never = format;
      throw new Error(`unsupported_format: ${exhaustive}`);
    }
  }
}

function resolveFfmpegPath() {
  return process.env.VOICE_FFMPEG_PATH?.trim() || "ffmpeg";
}

function runFfmpeg(args: string[], stdin?: Buffer): Buffer {
  const cmd = [resolveFfmpegPath(), ...args];
  const proc = Bun.spawnSync({
    cmd,
    stdin: stdin ?? new Uint8Array(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    const stderr = Buffer.from(proc.stderr ?? []).toString("utf-8");
    throw new Error(
      `ffmpeg_failed(exit=${proc.exitCode}): ${stderr || "no stderr"}`
    );
  }

  return Buffer.from(proc.stdout ?? []);
}

function stripBase64Prefix(raw: string) {
  const trimmed = raw.trim();
  const commaIndex = trimmed.indexOf(",");
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

export function isLikelyPCM(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  return (
    normalized.includes("pcm") ||
    normalized.includes("raw") ||
    normalized.includes("s16le")
  );
}

export function sanitizeBase64(raw: string) {
  return stripBase64Prefix(raw);
}

export function getPcmMetadata() {
  return {
    sampleRate: PCM_SAMPLE_RATE,
    channels: PCM_CHANNELS,
    bitDepth: PCM_BIT_DEPTH,
    mimeType: PCM_MIME_TYPE,
  };
}
