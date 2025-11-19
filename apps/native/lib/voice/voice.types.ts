/**
 * Shared voice queue and payload type definitions.
 * Pure types only—no runtime logic should live here.
 */

export type VoiceSttPayload = {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
};

export type VoiceTtsPayload = {
  text: string;
  voice?: string;
};

export type PendingSttItem = {
  ts: number;
  kind: "stt";
  payload: VoiceSttPayload;
  retryCount: number;
  lastError?: string;
};

export type PendingTtsItem = {
  ts: number;
  kind: "tts";
  payload: VoiceTtsPayload;
  retryCount: number;
  lastError?: string;
};

export type PendingItem = PendingSttItem | PendingTtsItem;
