import type {
  PlatformAdapter,
  VoiceCapturedClip,
  VoiceClient,
  VoiceSession,
  VoiceSessionOptions,
} from "./types";
export declare class VoiceSessionError extends Error {
  clip?: VoiceCapturedClip;
  constructor(
    message: string,
    options?: {
      clip?: VoiceCapturedClip;
      cause?: unknown;
    }
  );
}
export declare function createVoiceSession(
  adapter: PlatformAdapter,
  client: VoiceClient,
  options?: VoiceSessionOptions
): VoiceSession;
