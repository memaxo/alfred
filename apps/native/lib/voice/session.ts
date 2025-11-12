import { markVoice } from "@alfred/metrics/performance";
import type { PlatformAdapter, VoiceSession } from "@alfred/voice/session";
import { createVoiceSession } from "@alfred/voice/session";
import type { VoiceClient } from "@alfred/voice/transport";
import { createVoiceClient } from "@alfred/voice/transport";
import type { SttRequest } from "@alfred/voice/types";
import { Audio } from "expo-av";
import { useMemo } from "react";
import { ExpoCapture } from "./capture";
import { configureAudioSession } from "./config";
import { playBase64 } from "./play";
import { enqueue, type PendingItem } from "./queue";

interface MutationAdapter {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
}

function resolveMutation(
  rawClient: unknown,
  path: string,
  input: unknown
): Promise<unknown> {
  const anyClient = rawClient as Record<string, unknown> & {
    mutation?: (nextPath: string, nextInput: unknown) => Promise<unknown>;
  };
  if (typeof anyClient?.mutation === "function") {
    return anyClient.mutation(path, input);
  }
  const segments = path.split(".");
  let cursor: any = rawClient;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = cursor[segment];
    } else {
      cursor = null;
      break;
    }
  }
  if (cursor && typeof cursor.mutate === "function") {
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

function createNativePlatformAdapter(): PlatformAdapter {
  const capture = new ExpoCapture();
  return {
    configureSession: ({ background }) =>
      configureAudioSession(Audio, { background }),
    startCapture: () => capture.start(),
    stopCapture: () => capture.stop(),
    play: (base64, mimeType) => playBase64(base64, mimeType),
  };
}

function createSession(client: VoiceClient): VoiceSession {
  const adapter = createNativePlatformAdapter();
  return createVoiceSession(adapter, client);
}

export function useVoiceSessionNative(trpc: unknown) {
  const captureRef = useMemo(() => ({ current: new ExpoCapture() }), []);
  
  return useMemo(() => {
    const mutationAdapter = toMutationAdapter(trpc);
    const client = createVoiceClient({ trpc: mutationAdapter });
    
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

    return {
      state: session.state,
      start,
      stopAndTranscribe,
      speak,
      clear: session.clear,
    };
  }, [trpc, captureRef]);
}
