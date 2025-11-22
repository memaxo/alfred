import type { ModelProcess } from "./base";
import type { IPCResponse } from "./ipc";
import { MAYA_VOICES, resolveMayaVoice } from "./maya-types";
import type { TTSChunk, TTSRequest } from "./tts";

export class MayaTTSProcess {
  private readonly process: ModelProcess;
  private readonly defaultVoice: string;

  constructor(
    process: ModelProcess,
    defaultVoice = MAYA_VOICES.DEFAULT.description
  ) {
    this.process = process;
    this.defaultVoice = defaultVoice;
  }

  async synthesize(
    request: TTSRequest,
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const voice = request.voice
      ? resolveMayaVoice(request.voice)
      : this.defaultVoice;

    const requestId = crypto.randomUUID();

    const payload = {
      text: request.text,
      voice,
      streaming: request.streaming ?? false,
    };

    const handlePartial = (response: IPCResponse) => {
      if (onChunk && response.type === "audio") {
        const data = response.payload as {
          audioBase64: string;
          sampleRate: number;
        };
        onChunk({
          audioBase64: data.audioBase64,
          mimeType: "audio/pcm",
          sampleRate: data.sampleRate || 24_000,
        });
      }
    };

    const response = await this.process.sendRequest(
      {
        id: requestId,
        type: "synthesize",
        payload,
      },
      60_000, // 60s timeout for generation (Maya1 is slower)
      onChunk ? handlePartial : undefined
    );

    if (response.type === "error") {
      throw new Error(
        (response.payload as { message?: string })?.message ||
          "Unknown synthesis error"
      );
    }

    const payloadData = response.payload as {
      audioBase64: string;
      sampleRate: number;
    };

    return {
      audioBase64: payloadData.audioBase64,
      mimeType: "audio/pcm",
      sampleRate: payloadData.sampleRate || 24_000,
    };
  }
}
