import type { Process } from "./base";
import type { IPCResponse } from "./ipc";
import type { TTSChunk, TTSRequest } from "./tts";

/**
 * Maya1 Voice Presets and Types
 */
export const MAYA_VOICES = {
  ALFRED: {
    name: "Alfred",
    description:
      "Realistic male voice in the 30s age with british accent. " +
      "Low pitch, warm timbre, calm pacing, polite and professional tone.",
  },
  JARVIS: {
    name: "Jarvis",
    description:
      "Realistic male voice in the 30s age with american accent. " +
      "Normal pitch, clear timbre, fast pacing, helpful and precise tone.",
  },
  HER: {
    name: "Her",
    description:
      "Realistic female voice in the 20s age with american accent. " +
      "Normal pitch, breathy timbre, conversational pacing, intimate and warm tone.",
  },
  DEFAULT: {
    name: "Default",
    description:
      "Realistic male voice in the 30s age with american accent. " +
      "Normal pitch, warm timbre, conversational pacing.",
  },
} as const;

export type MayaVoicePreset = keyof typeof MAYA_VOICES;

/**
 * Emotions supported by Maya1 via inline tags.
 */
export const MAYA_EMOTIONS = [
  "laugh",
  "laugh_harder",
  "cry",
  "whisper",
  "sigh",
  "gasp",
  "giggle",
  "chuckle",
  "angry",
  "snort",
] as const;

export type MayaEmotion = (typeof MAYA_EMOTIONS)[number];

/**
 * Construct a Maya1 voice description string.
 */
export function buildVoiceDescription(opts: {
  age?: string;
  gender?: "male" | "female";
  accent?: string;
  pitch?: string;
  timbre?: string;
  pacing?: string;
  tone?: string;
}): string {
  const age = opts.age ?? "30s";
  const gender = opts.gender ?? "male";
  const accent = opts.accent ?? "american";
  const pitch = opts.pitch ?? "normal";
  const timbre = opts.timbre ?? "warm";
  const pacing = opts.pacing ?? "conversational";

  let desc = `Realistic ${gender} voice in the ${age} age with ${accent} accent. `;
  desc += `${pitch} pitch, ${timbre} timbre, ${pacing} pacing`;

  if (opts.tone) {
    desc += `, ${opts.tone} tone`;
  }

  return desc + ".";
}

/**
 * Resolve a voice input to a Maya1 description string.
 */
export function resolveMayaVoice(input?: string): string {
  if (!input) return MAYA_VOICES.DEFAULT.description;

  // Check if input matches a known preset key (case-insensitive)
  const upperInput = input.toUpperCase();
  // @ts-ignore - Dynamic check
  if (MAYA_VOICES[upperInput]) {
    // @ts-ignore
    return MAYA_VOICES[upperInput].description;
  }

  // Assume it's a raw description
  return input;
}

export class Maya {
  private readonly process: Process;
  private readonly defaultVoice: string;

  constructor(
    process: Process,
    defaultVoice = MAYA_VOICES.DEFAULT.description
  ) {
    this.process = process;
    this.defaultVoice = defaultVoice;
  }

  async synthesize(
    request: TTSRequest,
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const voice = request.voice
      ? resolveMayaVoice(request.voice)
      : this.defaultVoice;

    const requestId = crypto.randomUUID();

    const payload = {
      text: request.text,
      voice,
      streaming: request.streaming ?? false,
    };

    const handlePartial = (response: IPCResponse) => {
      if (onChunk && response.type === "audio") {
        const data = response.payload as {
          audioBase64: string;
          sampleRate: number;
        };
        onChunk({
          audioBase64: data.audioBase64,
          mimeType: "audio/pcm",
          sampleRate: data.sampleRate || 24_000,
        });
      }
    };

    const response = await this.process.sendRequest(
      {
        id: requestId,
        type: "synthesize",
        payload,
      },
      60_000, // 60s timeout for generation (Maya1 is slower)
      onChunk ? handlePartial : undefined
    );

    if (response.type === "error") {
      throw new Error(
        (response.payload as { message?: string })?.message ||
          "Unknown synthesis error"
      );
    }

    const payloadData = response.payload as {
      audioBase64: string;
      sampleRate: number;
    };

    return {
      audioBase64: payloadData.audioBase64,
      mimeType: "audio/pcm",
      sampleRate: payloadData.sampleRate || 24_000,
    };
  }
}
