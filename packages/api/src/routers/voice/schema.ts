import {
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
} from "@alfred/voice/services/config";
import { z } from "zod";

export const sttInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required").default("audio/webm"),
  model: z.string().min(1).default(DEFAULT_STT_MODEL),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
});

export const sttStreamingInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required").default("audio/webm"),
  model: z.string().min(1).default(DEFAULT_STT_MODEL),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
  sessionId: z.string().min(8).max(64),
  chunkSize: z.enum(["fast", "low", "medium", "accurate"]).optional(),
  clearCache: z.boolean().optional(),
});

export const sttSessionInput = z.object({
  sessionId: z.string().min(8).max(64),
});

export const ttsInput = z.object({
  text: z.string().min(1, "text_required").max(600, "text_too_long"),
  voice: z.string().min(1).default(DEFAULT_TTS_VOICE),
  format: z.enum(["mp3", "opus", "wav"]).default("mp3"),
  model: z.string().min(1).default(DEFAULT_TTS_MODEL),
});

export const voicePreviewInput = z.object({
  voice: z.string().min(1),
  text: z
    .string()
    .min(1)
    .max(100)
    .default("Hello, this is a preview of my voice."),
});

export const voiceSurfaceInput = z.enum([
  "drive",
  "carplay",
  "web",
  "native",
  "stream",
  "unknown",
]);

export const voiceStreamInput = z.object({
  mode: z.enum(["clip", "stream"]).default("stream"),
  sessionId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  surface: voiceSurfaceInput.optional(),
});

export const webrtcCreateInput = z.object({
  sessionId: z.string().min(8).max(64).optional(),
  surface: voiceSurfaceInput.default("web"),
});

export const webrtcSessionInput = z.object({
  sessionId: z.string().min(8).max(64),
});

export const webrtcOfferInput = z.object({
  sessionId: z.string().min(8).max(64),
  offer: z.object({
    type: z.literal("offer"),
    sdp: z.string().min(1),
  }),
});

export const webrtcIceInput = z.object({
  sessionId: z.string().min(8).max(64),
  candidate: z.object({
    candidate: z.string().min(1),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().int().nullable().optional(),
    usernameFragment: z.string().optional(),
  }),
});

export const s2sInput = z.object({
  audioBase64: z.string().min(1, "audio_base64_required"),
  mimeType: z.string().min(1, "mime_type_required"),
  thread: z.string().optional(),
  resource: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  prompt: z.string().max(400).optional(),
  sttModel: z.string().min(1).default(DEFAULT_STT_MODEL),
  ttsModel: z.string().min(1).default(DEFAULT_TTS_MODEL),
  ttsVoice: z.string().min(1).default(DEFAULT_TTS_VOICE),
  ttsFormat: z.enum(["mp3", "opus", "wav"]).default("mp3"),
  sessionId: z.string().min(8).max(64).optional(),
  surface: voiceSurfaceInput.default("web"),
  inputCodec: z.string().optional(),
  outputCodec: z.string().optional(),
});

export const voiceSessionStatusInput = z
  .object({
    sessionId: z.string().optional(),
  })
  .optional();

export const voiceDownloadInput = z.object({
  voiceId: z.string().min(1),
});

export const toSttResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<z.infer<typeof sttInput>>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_STT_MODEL,
  };
};

export const toTtsResource = (raw: unknown) => {
  const input = (raw ?? {}) as Partial<z.infer<typeof ttsInput>>;
  return {
    kind: "voice.model" as const,
    id:
      typeof input.model === "string" && input.model.length > 0
        ? input.model
        : DEFAULT_TTS_MODEL,
  };
};

export const toWebrtcResource = (_raw: unknown) => ({
  kind: "voice.model" as const,
  id: "local-webrtc",
});

