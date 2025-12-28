import { z } from "zod";

/**
 * Zod schema for VoiceStreamServerEvent
 */
export const voiceStreamServerEventSchema = z.discriminatedUnion("_", [
  z.object({ _: z.literal("ready"), sessionId: z.null() }),
  z.object({
    _: z.literal("vad_start"),
    sessionId: z.string(),
    ts: z.number(),
  }),
  z.object({
    _: z.literal("vad_stop"),
    sessionId: z.string(),
    ts: z.number(),
  }),
  z.object({
    _: z.literal("stt_result"),
    sessionId: z.string(),
    text: z.string(),
    isFinal: z.boolean(),
  }),
  z.object({
    _: z.literal("tts_chunk"),
    sessionId: z.string(),
    audio: z.unknown(),
    mimeType: z.string(),
  }),
  z.object({
    _: z.literal("status"),
    sessionId: z.string().nullable(),
    state: z.enum(["recording", "processing", "playing", "idle"]),
  }),
  z.object({
    _: z.literal("auto_stop"),
    sessionId: z.string(),
    reason: z.enum(["manual", "silence", "timeout"]),
  }),
]);
