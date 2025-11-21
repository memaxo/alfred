import { ModelProcess, type ProcessConfig, type ProcessHealth } from "./base";

// Re-export ProcessConfig for use in other packages
export type { ProcessConfig };

export interface TTSRequest {
  text: string;
  voice?: string;
  streaming?: boolean;
}

export interface TTSChunk {
  audioBase64: string;
  mimeType: string;
  sampleRate?: number;
}

export class TTSPool {
  private processes: ModelProcess[] = [];
  private currentIndex = 0;
  private config: ProcessConfig;
  private poolSize: number;

  constructor(config: ProcessConfig, poolSize = 2) {
    this.config = config;
    this.poolSize = poolSize;
  }

  async initialize(): Promise<void> {
    console.log(
      `[voice] Initializing TTS pool with ${this.poolSize} processes`
    );

    for (let i = 0; i < this.poolSize; i++) {
      const process = new ModelProcess(this.config);
      this.processes.push(process);
    }

    // Start all processes
    await Promise.all(this.processes.map((p) => p.start()));

    console.log(
      `[voice] TTS pool ready with ${this.processes.length} processes`
    );
  }

  private getNextProcess(): ModelProcess {
    // Round-robin selection
    if (this.processes.length === 0) {
      throw new Error("No processes available");
    }
    const process = this.processes[this.currentIndex];
    if (!process) {
      throw new Error("Process not found");
    }
    this.currentIndex = (this.currentIndex + 1) % this.processes.length;
    return process;
  }

  async synthesize(
    request: TTSRequest,
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const process = this.getNextProcess();
    const streamingRequested = (request.streaming ?? false) && typeof onChunk === "function";

    if (streamingRequested && onChunk) {
      return this.streamSentences(process, request, onChunk);
    }

    return this.sendSynthesis(process, {
      text: request.text,
      voice: request.voice,
      streaming: request.streaming ?? false,
    }, onChunk);
  }

  private async streamSentences(
    process: ModelProcess,
    request: TTSRequest,
    onChunk: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const sentences = splitIntoSentences(request.text);
    let lastChunk: TTSChunk | null = null;
    const segments = sentences.length > 0 ? sentences : [request.text];

    for (const sentence of segments) {
      const chunk = await this.sendSynthesis(
        process,
        {
          text: sentence,
          voice: request.voice,
          streaming: false,
        },
        (partial) => onChunk(partial)
      );
      lastChunk = chunk;
    }

    if (!lastChunk) {
      lastChunk = await this.sendSynthesis(
        process,
        {
          text: request.text,
          voice: request.voice,
          streaming: false,
        },
        (partial) => onChunk(partial)
      );
    }

    return lastChunk;
  }

  private async sendSynthesis(
    process: ModelProcess,
    params: { text: string; voice?: string; streaming: boolean },
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const ipcRequest = process["ipc"].createRequest("synthesize", {
      text: params.text,
      voice: params.voice,
      streaming: params.streaming,
    });

    const response = await process.sendRequest(ipcRequest);

    if (response.type === "error") {
      throw new Error(
        (response.payload as { message?: string })?.message ??
          "Synthesis failed"
      );
    }

    if (response.type === "audio" && response.payload) {
      const payload = response.payload as {
        audioBase64?: string;
        mimeType?: string;
        sampleRate?: number;
      };
      const chunk = {
        audioBase64: payload.audioBase64 ?? "",
        mimeType: payload.mimeType ?? "audio/pcm",
        sampleRate: payload.sampleRate,
      };
      if (onChunk) {
        onChunk(chunk);
      }
      return chunk;
    }
    throw new Error("Unexpected response type");
  }

  getHealth(): ProcessHealth[] {
    return this.processes.map((p) => p.getHealth());
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processes.map((p) => p.shutdown()));
    this.processes = [];
  }
}

function splitIntoSentences(text: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
