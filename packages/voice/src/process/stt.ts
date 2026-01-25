import { Process, type ProcessConfig, type ProcessHealth } from "./base";

// Re-export ProcessConfig for use in other packages
export type { ProcessConfig };

/**
 * Chunk size configuration for latency/accuracy tradeoff.
 * - "fast": 80ms chunks, lowest latency
 * - "low": 160ms chunks
 * - "medium": 560ms chunks, balanced (default)
 * - "accurate": 1.12s chunks, highest accuracy
 */
export type ChunkSize = "fast" | "low" | "medium" | "accurate";

export interface STTRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  streaming?: boolean;
  vadThreshold?: number;
  sessionId?: string;
  /** Chunk size for latency/accuracy tradeoff */
  chunkSize?: ChunkSize;
  /** Clear session cache before transcription */
  clearCache?: boolean;
}

export interface STTResult {
  text: string;
  language?: string;
  isPartial?: boolean;
  isEmpty?: boolean;
  durationSeconds?: number;
  model?: string;
  vadConfidence?: number;
  endOfUtterance?: boolean;
  processingTime?: number;
  streamingEnabled?: boolean;
}

export class STTPool {
  private processes: Process[] = [];
  private currentIndex = 0;
  private readonly config: ProcessConfig;
  private readonly poolSize: number;
  private _activeCount = 0;

  /**
   * Session affinity map: sessionId -> process index.
   * Ensures cache-aware streaming uses the same process for a session.
   */
  private readonly sessionProcessMap: Map<string, number> = new Map();

  /**
   * Track last access time for session cleanup.
   */
  private readonly sessionLastAccess: Map<string, number> = new Map();

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

  /**
   * Get process for a session with affinity.
   * If session already has an assigned process, return it.
   * Otherwise, assign using round-robin.
   */
  private getProcessForSession(sessionId?: string): Process {
    if (this.processes.length === 0) {
      throw new Error("No processes available");
    }

    // If no sessionId, use round-robin
    if (!sessionId) {
      return this.getNextProcess();
    }

    // Check for existing affinity
    let processIndex = this.sessionProcessMap.get(sessionId);

    if (processIndex === undefined) {
      // Assign new process using round-robin
      processIndex = this.currentIndex;
      this.sessionProcessMap.set(sessionId, processIndex);
      this.currentIndex = (this.currentIndex + 1) % this.processes.length;
    }

    // Update last access time
    this.sessionLastAccess.set(sessionId, Date.now());

    const process = this.processes[processIndex];
    if (!process) {
      // Process may have been removed, reassign
      this.sessionProcessMap.delete(sessionId);
      return this.getProcessForSession(sessionId);
    }

    return process;
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
    if (this._activeCount >= this.poolSize) {
      throw new Error("voice_stt_pool_saturated");
    }

    // Use session affinity for cache-aware streaming
    const process = this.getProcessForSession(request.sessionId);
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
        chunkSize: request.chunkSize,
        clearCache: request.clearCache,
      });

      const response = await process.sendRequest(ipcRequest);

      if (response.type === "error") {
        const payload = response.payload as {
          message?: string;
          traceback?: string;
        };
        const message = payload?.message ?? "Transcription failed";

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
        processingTime?: number;
        streamingEnabled?: boolean;
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
        processingTime: payload.processingTime,
        streamingEnabled: payload.streamingEnabled,
      };
    } finally {
      this._activeCount--;
    }
  }

  /**
   * Clear the cache for a specific session in the Python process.
   */
  async clearSessionCache(sessionId: string): Promise<boolean> {
    const processIndex = this.sessionProcessMap.get(sessionId);
    if (processIndex === undefined) {
      return false;
    }

    const process = this.processes[processIndex];
    if (!process) {
      this.sessionProcessMap.delete(sessionId);
      this.sessionLastAccess.delete(sessionId);
      return false;
    }

    try {
      const ipcRequest = process.ipc.createRequest("clear_cache", {
        sessionId,
      });

      const response = await process.sendRequest(ipcRequest);
      return response.type !== "error";
    } catch {
      return false;
    } finally {
      // Remove from local maps regardless of remote result
      this.sessionProcessMap.delete(sessionId);
      this.sessionLastAccess.delete(sessionId);
    }
  }

  /**
   * Release session affinity without clearing remote cache.
   * Useful when a session ends but cache might be reused.
   */
  releaseSession(sessionId: string): void {
    this.sessionProcessMap.delete(sessionId);
    this.sessionLastAccess.delete(sessionId);
  }

  /**
   * Clean up idle sessions that haven't been accessed recently.
   */
  cleanupIdleSessions(maxIdleMs: number = 5 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, lastAccess] of this.sessionLastAccess.entries()) {
      if (now - lastAccess > maxIdleMs) {
        this.sessionProcessMap.delete(sessionId);
        this.sessionLastAccess.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get session affinity info for debugging.
   */
  getSessionInfo(sessionId: string): {
    hasAffinity: boolean;
    processIndex?: number;
    lastAccess?: number;
  } {
    const processIndex = this.sessionProcessMap.get(sessionId);
    const lastAccess = this.sessionLastAccess.get(sessionId);

    return {
      hasAffinity: processIndex !== undefined,
      processIndex,
      lastAccess,
    };
  }

  getHealth(): ProcessHealth[] {
    return this.processes.map((p) => p.getHealth());
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processes.map((p) => p.shutdown()));
    this.processes = [];
    this.sessionProcessMap.clear();
    this.sessionLastAccess.clear();
  }
}
