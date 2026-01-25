import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  SttRequest,
  SttResult,
  SttStreamingRequest,
  SttStreamingResult,
  TtsRequest,
  TtsResult,
  VoiceClient,
} from "../types";

interface MutationAdapter {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
}

export function createVoiceClient({
  trpc,
}: {
  trpc: MutationAdapter;
}): VoiceClient {
  return {
    sttTranscribe: (input: SttRequest): Promise<SttResult> =>
      trpc.mutation("voice.sttTranscribe", input),
    sttTranscribeStreaming: (
      input: SttStreamingRequest
    ): Promise<SttStreamingResult> =>
      trpc.mutation("voice.sttTranscribeStreaming", input),
    sttClearCache: (input: {
      sessionId: string;
    }): Promise<{
      cleared: boolean;
      sessionId: string;
    }> => trpc.mutation("voice.sttClearCache", input),
    sttReleaseSession: (input: {
      sessionId: string;
    }): Promise<{
      released: boolean;
      sessionId: string;
    }> => trpc.mutation("voice.sttReleaseSession", input),
    ttsSynthesize: (input: TtsRequest): Promise<TtsResult> =>
      trpc.mutation("voice.ttsSynthesize", input),
    speechToSpeech: (
      input: SpeechToSpeechRequest
    ): Promise<SpeechToSpeechResponse> =>
      trpc.mutation("voice.speechToSpeech", input),
  };
}
