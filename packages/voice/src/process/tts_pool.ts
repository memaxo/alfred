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
    const ipcRequest = process["ipc"].createRequest("synthesize", {
      text: request.text,
      voice: request.voice,
      streaming: request.streaming ?? onChunk !== undefined,
    });

    if (request.streaming && onChunk) {
      // For streaming, we need to handle multiple responses
      // This is a simplified version - in practice, you'd set up a listener
      const response = await process.sendRequest(ipcRequest);

      if (response.type === "error") {
        throw new Error(
          (response.payload as { message?: string })?.message ??
            "Synthesis failed"
        );
      }

      // Handle streaming chunks (simplified - actual implementation would handle multiple chunks)
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
        onChunk(chunk);
        return chunk;
      }
      throw new Error("Unexpected response type");
    } else {
      // Non-streaming: wait for complete response
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
  }

  getHealth(): ProcessHealth[] {
    return this.processes.map((p) => p.getHealth());
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processes.map((p) => p.shutdown()));
    this.processes = [];
  }
}
