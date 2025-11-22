/**
 * Maya1 Voice Presets and Types
 *
 * Maya1 uses natural language descriptions for voice design.
 * This file provides typed presets and helper functions to construct valid descriptions.
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
 * Usage: "Hello <laugh> world!"
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
 *
 * @param age - Age group (e.g., "20s", "30s", "40s")
 * @param gender - "male" or "female"
 * @param accent - Accent (e.g., "american", "british", "australian")
 * @param pitch - Pitch level ("low", "normal", "high")
 * @param timbre - Voice quality ("warm", "gravelly", "breathy", "clear")
 * @param pacing - Speaking speed ("slow", "conversational", "fast")
 * @param tone - Emotional tone (e.g., "professional", "friendly", "angry")
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
 * Accepts a preset name (e.g. "ALFRED") or a raw description string.
 */
export function resolveMayaVoice(input?: string): string {
  if (!input) return MAYA_VOICES.DEFAULT.description;

  // Check if input matches a known preset key (case-insensitive)
  const upperInput = input.toUpperCase();
  if (upperInput in MAYA_VOICES) {
    return MAYA_VOICES[upperInput as MayaVoicePreset].description;
  }

  // Assume it's a raw description
  return input;
}
