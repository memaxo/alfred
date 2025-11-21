import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  SttRequest,
  SttResult,
  TtsRequest,
  TtsResult,
  VoiceClient,
} from "../types";

type MutationAdapter = {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
};

export function createVoiceClient({ trpc }: { trpc: MutationAdapter }): VoiceClient {
  return {
    sttTranscribe: (input: SttRequest): Promise<SttResult> =>
      trpc.mutation("voice.sttTranscribe", input),
    ttsSynthesize: (input: TtsRequest): Promise<TtsResult> =>
      trpc.mutation("voice.ttsSynthesize", input),
    speechToSpeech: (input: SpeechToSpeechRequest): Promise<SpeechToSpeechResponse> =>
      trpc.mutation("voice.speechToSpeech", input),
  };
}
