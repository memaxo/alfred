import { appRouter } from "@alfred/api/router";

import { playAudioBase64 } from "../cli/audio";
import { createCliContext } from "../cli/context";

function writeStdout(text: string): void {
  process.stdout.write(text);
}

function isSpeakDisabled(args: string[]): boolean {
  if (process.env.ALFRED_TUI_NO_AUDIO === "1") {
    return true;
  }
  return args.includes("--no-play");
}

function inferMime(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".opus")) {
    return "audio/ogg";
  }
  if (lower.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (lower.endsWith(".webm")) {
    return "audio/webm";
  }
  return "application/octet-stream";
}

function getFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) {
    return null;
  }
  const next = args[idx + 1];
  if (!next || next.startsWith("--")) {
    return null;
  }
  return next;
}

export async function voiceCommands(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    writeStdout(
      `${`
Usage: alfred voice --file <path> [--mime <mimeType>] [--no-play]

Sends an audio clip through the unified voice pipeline (STT → assistant → TTS).

Options:
  --file <path>     Audio file path (wav/mp3/webm/ogg)
  --mime <mimeType> Override mime type (default inferred from extension)
  --no-play         Do not play returned audio (prints transcript + text only)
`.trim()}\n`
    );
    return;
  }

  const filePath = getFlag(args, "--file");
  if (!filePath) {
    throw new Error("voice_file_required");
  }

  const mimeType = getFlag(args, "--mime") ?? inferMime(filePath);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error("voice_file_not_found");
  }

  const bytes = await file.arrayBuffer();
  const audioBase64 = Buffer.from(bytes).toString("base64");

  const ctx = await createCliContext();
  if (!ctx.session?.user?.id) {
    throw new Error("session_required");
  }

  const caller = appRouter.createCaller(ctx);
  const result = await caller.voice.speechToSpeech({
    audioBase64,
    mimeType,
    ttsFormat: "wav",
    ttsVoice: "alloy",
    surface: "unknown",
  });

  const transcript = (result?.transcript?.text ?? "").trim();
  const assistant = (result?.assistant?.text ?? "").trim();
  writeStdout(`${transcript ? `Transcript: ${transcript}\n` : ""}`);
  writeStdout(`${assistant ? `Assistant: ${assistant}\n` : ""}`);

  if (!isSpeakDisabled(args) && result?.audio?.audioBase64) {
    await playAudioBase64({
      audioBase64: result.audio.audioBase64,
      mimeType: result.audio.mimeType,
    });
  }
}
