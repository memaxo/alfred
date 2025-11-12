/**
 * Voice streaming event types
 */

export type VoiceStreamEvent =
  | {
      type: "status";
      status: "connecting" | "connected" | "disconnected";
      timestamp: number;
    }
  | {
      type: "audio_chunk";
      audioBase64: string;
      mimeType: string;
      sampleRate?: number;
      timestamp: number;
    }
  | {
      type: "transcript_partial";
      text: string;
      timestamp: number;
      language?: string;
    }
  | {
      type: "transcript_final";
      text: string;
      language?: string;
      timestamp: number;
    }
  | {
      type: "synthesis_chunk";
      audioBase64: string;
      mimeType: string;
      sampleRate?: number;
      timestamp: number;
    }
  | {
      type: "error";
      message: string;
      code?: string;
      timestamp: number;
    }
  | {
      type: "complete";
      timestamp: number;
    };

export interface VoiceStreamInput {
  mode?: "clip" | "stream";
  sessionId?: string;
  language?: string;
}

