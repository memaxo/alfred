import { Process, type ProcessConfig, type ProcessHealth } from "./base";

// Re-export ProcessConfig for use in other packages
export type { ProcessConfig };

export type STTRequest = {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  streaming?: boolean;
  vadThreshold?: number;
  sessionId?: string;
};

export type STTResult = {
  text: string;
  language?: string;
  isPartial?: boolean;
  isEmpty?: boolean;
  durationSeconds?: number;
  model?: string;
  vadConfidence?: number;
  endOfUtterance?: boolean;
};

export class STTPool {
  private processes: Process[] = [];
  private currentIndex = 0;
  private readonly config: ProcessConfig;
  private readonly poolSize: number;
  private _activeCount = 0;

  constructor(config: ProcessConfig, poolSize = 2) {
    this.config = config;
    this.poolSize = poolSize;
  }

  get size(): number {
    return this.poolSize;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      const process = new Process(this.config);
      this.processes.push(process);
    }

    // Start all processes
    await Promise.all(this.processes.map((p) => p.start()));
  }

  private getNextProcess(): Process {
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
    this._activeCount++;
    try {
      const ipcRequest = process.ipc.createRequest("transcribe", {
        audioBase64: request.audioBase64,
        mimeType: request.mimeType,
        language: request.language,
        prompt: request.prompt,
        streaming: request.streaming ?? false,
        vadThreshold: request.vadThreshold,
        sessionId: request.sessionId,
      });

      const response = await process.sendRequest(ipcRequest);

      if (response.type === "error") {
        const payload = response.payload as {
          message?: string;
          traceback?: string;
        };
        const message = payload?.message ?? "Transcription failed";
        const traceback = payload?.traceback;

        if (traceback) {
          // Log detailed traceback if available (could use logger, but here we ensure it propagates or logs)
          console.error(`STT Process Error Traceback:\n${traceback}`);
        }

        throw new Error(message);
      }

      const payload = response.payload as {
        text?: string;
        language?: string;
        isPartial?: boolean;
        isEmpty?: boolean;
        durationSeconds?: number;
        model?: string;
        vadConfidence?: number;
        endOfUtterance?: boolean;
      };

      return {
        text: payload.text ?? "",
        language: payload.language,
        isPartial: payload.isPartial,
        isEmpty: payload.isEmpty,
        durationSeconds: payload.durationSeconds,
        model: payload.model,
        vadConfidence: payload.vadConfidence,
        endOfUtterance: payload.endOfUtterance,
      };
    } finally {
      this._activeCount--;
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
