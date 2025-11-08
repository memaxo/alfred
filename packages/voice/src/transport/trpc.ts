import type { SttRequest, SttResult, TtsRequest, TtsResult } from "../types";

export interface VoiceClient {
  stt(input: SttRequest): Promise<SttResult>;
  tts(input: TtsRequest): Promise<TtsResult>;
}

interface TrpcMutationClient {
  mutation<TInput, TOutput>(path: string, input: TInput): Promise<TOutput>;
}

const STT_PATH = "voice.sttTranscribe";
const TTS_PATH = "voice.ttsSynthesize";

export function createVoiceClient(opts: {
  trpc: TrpcMutationClient;
}): VoiceClient {
  const { trpc } = opts;
  return {
    async stt(input) {
      return trpc.mutation<SttRequest, SttResult>(STT_PATH, input);
    },
    async tts(input) {
      return trpc.mutation<TtsRequest, TtsResult>(TTS_PATH, input);
    },
  };
}
