import { markVoice } from "@alfred/metrics/performance";
import type {
  PlatformAdapter,
  VoiceSession,
} from "@alfred/voice/session";
import { createVoiceSession, VoiceSessionError } from "@alfred/voice/session";
import { createVoiceClient } from "@alfred/voice/transport";
import type {
  SpeechToSpeechRequest,
  SttRequest,
} from "@alfred/voice/types";
import { Audio } from "expo-av";
import { useMemo } from "react";
import { ExpoCapture } from "./capture";
import { configureAudioSession } from "./config";
import { playBase64 } from "./play";
import { enqueue } from "./queue";
import type { VoiceS2SPayload } from "./voice.types";

type MutationAdapter = {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
};

type MutationInvoker = (path: string, input: unknown) => Promise<unknown>;

function hasMutationInvoker(
  value: unknown
): value is { mutation: MutationInvoker } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { mutation?: unknown }).mutation === "function"
  );
}

function hasMutate(
  value: unknown
): value is { mutate: (input: unknown) => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { mutate?: unknown }).mutate === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveMutation(
  rawClient: unknown,
  path: string,
  input: unknown
): Promise<unknown> {
  if (hasMutationInvoker(rawClient)) {
    return rawClient.mutation(path, input);
  }

  const segments = path.split(".");
  let cursor: unknown = rawClient;

  for (const segment of segments) {
    if (isRecord(cursor) && segment in cursor) {
      cursor = cursor[segment];
    } else {
      cursor = null;
      break;
    }
  }

  if (hasMutate(cursor)) {
    return cursor.mutate(input);
  }

  throw new Error(`tRPC client missing mutation handler for ${path}`);
}

function toMutationAdapter(trpc: unknown): MutationAdapter {
  return {
    mutation: <TInput, TOutput>(path: string, input: TInput) =>
      resolveMutation(trpc, path, input) as Promise<TOutput>,
  };
}

type VoiceSessionNativeOptions = {
  mode?: "classic" | "s2s";
  speechDefaults?: Partial<
    Pick<
      SpeechToSpeechRequest,
      "thread" | "resource" | "ttsVoice" | "ttsFormat" | "language" | "prompt"
    >
  >;
};

export function useVoiceSessionNative(
  trpc: unknown,
  options?: VoiceSessionNativeOptions
) {
  const captureRef = useMemo(() => ({ current: new ExpoCapture() }), []);

  return useMemo(() => {
    const mutationAdapter = toMutationAdapter(trpc);
    const client = createVoiceClient({ trpc: mutationAdapter });
    const preferredMode = options?.mode ?? "s2s";
    const preferSpeechToSpeech = preferredMode !== "classic";
    const speechDefaults = {
      thread: options?.speechDefaults?.thread,
      resource: options?.speechDefaults?.resource,
      ttsVoice: options?.speechDefaults?.ttsVoice ?? "alloy",
      ttsFormat: options?.speechDefaults?.ttsFormat ?? "mp3",
      language: options?.speechDefaults?.language,
      prompt: options?.speechDefaults?.prompt,
    };

    // Create adapter with capture reference
    const adapter: PlatformAdapter = {
      configureSession: ({ background }) =>
        configureAudioSession(Audio, { background }),
      startCapture: () => captureRef.current.start(),
      stopCapture: () => captureRef.current.stop(),
      play: (base64, mimeType) => playBase64(base64, mimeType),
    };

    const session = createVoiceSession(adapter, client);

    const start = async () => {
      markVoice("fast_capture_start");
      await session.start();
    };

    const stopAndTranscribe = async (opts?: Partial<SttRequest>) => {
      try {
        const result = await session.stopAndTranscribe(opts);
        markVoice("fast_stream_flush");
        return result;
      } catch (error) {
        // On error, enqueue for retry
        const audio = await captureRef.current.stop();
        if (audio) {
          await enqueue({
            kind: "stt",
            payload: {
              audioBase64: audio.audioBase64,
              mimeType: audio.mimeType,
              language: opts?.language,
              prompt: opts?.prompt,
            },
          });
        }
        throw error;
      }
    };

    const speak = async (opts: Parameters<VoiceSession["speak"]>[0]) => {
      try {
        await session.speak(opts);
      } catch (error) {
        // On error, enqueue for retry
        await enqueue({
          kind: "tts",
          payload: {
            text: opts.text,
            voice: opts.voice,
          },
        });
        throw error;
      }
    };

    const speechToSpeech =
      preferSpeechToSpeech && session.speechToSpeech
        ? async (
            overrides?: Partial<
              Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">
            >
          ) => {
            const payloadOverrides = {
              thread: overrides?.thread ?? speechDefaults.thread,
              resource: overrides?.resource ?? speechDefaults.resource,
              ttsVoice: overrides?.ttsVoice ?? speechDefaults.ttsVoice,
              ttsFormat: overrides?.ttsFormat ?? speechDefaults.ttsFormat,
              language: overrides?.language ?? speechDefaults.language,
              prompt: overrides?.prompt ?? speechDefaults.prompt,
              sttModel: overrides?.sttModel,
              ttsModel: overrides?.ttsModel,
            };
            try {
              const result = await session.speechToSpeech?.(payloadOverrides);
              markVoice("fast_stream_flush");
              return result ?? null;
            } catch (error) {
              if (error instanceof VoiceSessionError && error.clip) {
                const queuedPayload: VoiceS2SPayload = {
                  audioBase64: error.clip.audioBase64,
                  mimeType: error.clip.mimeType,
                  language: payloadOverrides.language,
                  prompt: payloadOverrides.prompt,
                  thread: payloadOverrides.thread,
                  resource: payloadOverrides.resource,
                  ttsVoice: payloadOverrides.ttsVoice,
                  ttsFormat: payloadOverrides.ttsFormat,
                };
                await enqueue({
                  kind: "s2s",
                  payload: queuedPayload,
                });
              }
              throw error;
            }
          }
        : undefined;

    return {
      state: session.state,
      start,
      stopAndTranscribe,
      speak,
      speechToSpeech,
      clear: session.clear,
    };
  }, [captureRef, options, trpc]);
}
