import { ModelProcess, type ProcessConfig, type ProcessHealth } from "./base";

// Re-export ProcessConfig for use in other packages
export type { ProcessConfig };

export interface STTRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  streaming?: boolean;
}

export interface STTResult {
  text: string;
  language?: string;
  isPartial?: boolean;
  isEmpty?: boolean;
  durationSeconds?: number;
  model?: string;
}

export class STTPool {
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
      `[voice] Initializing STT pool with ${this.poolSize} processes`
    );

    for (let i = 0; i < this.poolSize; i++) {
      const process = new ModelProcess(this.config);
      this.processes.push(process);
    }

    // Start all processes
    await Promise.all(this.processes.map((p) => p.start()));

    console.log(
      `[voice] STT pool ready with ${this.processes.length} processes`
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

  async transcribe(request: STTRequest): Promise<STTResult> {
    const process = this.getNextProcess();
    const ipcRequest = process["ipc"].createRequest("transcribe", {
      audioBase64: request.audioBase64,
      mimeType: request.mimeType,
      language: request.language,
      prompt: request.prompt,
      streaming: request.streaming ?? false,
    });

    const response = await process.sendRequest(ipcRequest);

    if (response.type === "error") {
      throw new Error(
        (response.payload as { message?: string })?.message ??
          "Transcription failed"
      );
    }

    const payload = response.payload as {
      text?: string;
      language?: string;
      isPartial?: boolean;
      isEmpty?: boolean;
      durationSeconds?: number;
      model?: string;
    };

    return {
      text: payload.text ?? "",
      language: payload.language,
      isPartial: payload.isPartial,
      isEmpty: payload.isEmpty,
      durationSeconds: payload.durationSeconds,
      model: payload.model,
    };
  }

  getHealth(): ProcessHealth[] {
    return this.processes.map((p) => p.getHealth());
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processes.map((p) => p.shutdown()));
    this.processes = [];
  }
}
