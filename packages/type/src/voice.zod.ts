import { z } from "zod";

import type { VoiceAssistantRaw } from "./voice";

import { uiMessageSchema } from "./stream.zod";

/**
 * Zod schema for VoiceStreamServerEvent
 */
export const voiceAssistantRawSchema = z.object({
  uiMessages: z.array(uiMessageSchema),
  meta: z
    .object({
      runId: z.string().optional(),
      planId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export function parseVoiceAssistantRaw(
  value: unknown
): { ok: true; value: VoiceAssistantRaw } | { ok: false; error: string } {
  const res = voiceAssistantRawSchema.safeParse(value);
  if (res.success) {
    return { ok: true, value: res.data as VoiceAssistantRaw };
  }
  return { ok: false, error: res.error.message };
}

export const voiceStreamServerEventSchema = z.discriminatedUnion("_", [
  z.object({
    _: z.literal("ready"),
    sessionId: z.null(),
    protocolVersion: z.number().int().positive().optional(),
  }),
  z.object({
    _: z.literal("session_started"),
    sessionId: z.string(),
    codec: z.enum(["pcm", "mp3", "opus", "wav"]),
    negotiatedCodec: z.enum(["pcm", "mp3", "opus", "wav"]),
    protocolVersion: z.number().int().positive().optional(),
    inputMimeType: z.string().optional(),
    ttsFormat: z.enum(["mp3", "opus", "wav"]).optional(),
  }),
  z.object({
    _: z.literal("partial_transcript"),
    sessionId: z.string(),
    text: z.string(),
  }),
  z.object({
    _: z.literal("final_transcript"),
    sessionId: z.string(),
    text: z.string(),
  }),
  z.object({
    _: z.literal("vad_state"),
    sessionId: z.string(),
    vadConfidence: z.number().nullable(),
    isEmpty: z.boolean().nullable(),
    endOfUtterance: z.boolean().nullable(),
  }),
  z.object({
    _: z.literal("auto_stop"),
    sessionId: z.string(),
    reason: z.enum(["manual", "silence", "timeout"]),
  }),
  z.object({ _: z.literal("interrupt"), sessionId: z.string() }),
  z.object({
    _: z.literal("assistant_message"),
    sessionId: z.string(),
    text: z.string(),
    replayId: z.string().nullable().optional(),
    raw: voiceAssistantRawSchema.optional(),
  }),
  z.object({
    _: z.literal("tts_chunk"),
    sessionId: z.string(),
    audioBase64: z.string(),
    mimeType: z.string(),
    sequence: z.number().int().nonnegative(),
    isLast: z.boolean().optional(),
  }),
  z.object({ _: z.literal("tts_complete"), sessionId: z.string() }),
  z.object({
    _: z.literal("status"),
    sessionId: z.string().nullable(),
    state: z.enum(["recording", "processing", "playing", "idle"]),
  }),
  z.object({
    _: z.literal("error"),
    sessionId: z.string().nullable(),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    _: z.literal("pong"),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    _: z.literal("telemetry_report"),
    sessionId: z.string(),
    packetLoss: z.number(),
    jitter: z.number(),
    rtt: z.number(),
    timestamp: z.number(),
  }),
]);
