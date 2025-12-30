import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type Player = {
  cmd: string;
  args: (filePath: string) => string[];
};

function isAudioDisabled(): boolean {
  const raw = process.env.ALFRED_TUI_NO_AUDIO;
  return raw === "1" || raw === "true";
}

function extForMime(mimeType: string): string {
  if (mimeType.includes("wav")) {
    return "wav";
  }
  if (mimeType.includes("ogg") || mimeType.includes("opus")) {
    return "opus";
  }
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }
  return "bin";
}

function getPlayers(): Player[] {
  if (process.platform === "darwin") {
    return [{ cmd: "afplay", args: (p) => [p] }];
  }

  // Linux (best effort). Prefer PulseAudio if present.
  return [
    { cmd: "paplay", args: (p) => [p] },
    { cmd: "aplay", args: (p) => [p] },
    { cmd: "play", args: (p) => [p] },
    { cmd: "ffplay", args: (p) => ["-nodisp", "-autoexit", p] },
  ];
}

async function trySpawn(cmd: string, args: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

export async function playAudioBase64(input: {
  audioBase64: string;
  mimeType: string;
}): Promise<boolean> {
  if (isAudioDisabled()) {
    return false;
  }

  const players = getPlayers();

  const ext = extForMime(input.mimeType);
  const filePath = path.join(tmpdir(), `alfred-audio-${randomUUID()}.${ext}`);
  try {
    const bytes = Buffer.from(input.audioBase64, "base64");
    await Bun.write(filePath, bytes);
    for (const player of players) {
      if (await trySpawn(player.cmd, player.args(filePath))) {
        return true;
      }
    }
    return false;
  } finally {
    try {
      await unlink(filePath);
    } catch {
      // ignore
    }
  }
}
