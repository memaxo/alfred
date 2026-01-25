import type { VoiceSessionSurface } from "@alfred/voice/types";

/**
 * Shared voice queue and payload type definitions.
 * Pure types only—no runtime logic should live here.
 */

export interface VoiceSttPayload {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
}

export interface VoiceTtsPayload {
  text: string;
  voice?: string;
}

export interface VoiceS2SPayload {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  thread?: string;
  resource?: string;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
  sessionId?: string;
  surface?: VoiceSessionSurface;
}

export interface PendingSttItem {
  ts: number;
  kind: "stt";
  payload: VoiceSttPayload;
  retryCount: number;
  lastError?: string;
}

export interface PendingTtsItem {
  ts: number;
  kind: "tts";
  payload: VoiceTtsPayload;
  retryCount: number;
  lastError?: string;
}

export interface PendingS2SItem {
  ts: number;
  kind: "s2s";
  payload: VoiceS2SPayload;
  retryCount: number;
  lastError?: string;
}

export type PendingItem = PendingSttItem | PendingTtsItem | PendingS2SItem;
