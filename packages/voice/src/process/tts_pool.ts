import type { ProcessConfig } from "./base";
import { PiperTTSManager, type PiperTTSConfig } from "./piper_tts";

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

export interface ProcessHealth {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
}

export class TTSPool {
  private manager: PiperTTSManager;
  private poolSize: number;
  private _activeCount = 0;
  private requestCount = 0;
  private errorCount = 0;
  private startTime = 0;
  private initialized = false;

  constructor(config: ProcessConfig, poolSize = 2) {
    // Convert ProcessConfig to PiperTTSConfig
    const piperConfig: PiperTTSConfig = {
      modelPath: config.modelPath,
      defaultVoice: config.voice ?? "en_US-lessac-medium",
    };
    this.manager = new PiperTTSManager(piperConfig);
    this.poolSize = poolSize; // Keep for compatibility, but not used for in-process implementation
  }

  get size(): number {
    return this.poolSize;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`[voice] Initializing TTS pool (TypeScript implementation)`);

    try {
      await this.manager.initialize();
      this.startTime = Date.now();
      this.initialized = true;
      console.log(`[voice] TTS pool ready`);
    } catch (error) {
      throw new Error(
        `Failed to initialize TTS pool: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async synthesize(
    request: TTSRequest,
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    if (!this.initialized) {
      await this.initialize();
    }

    this._activeCount++;
    this.requestCount++;

    try {
      const streamingRequested = (request.streaming ?? false) && typeof onChunk === "function";

      if (streamingRequested && onChunk) {
        return await this.streamSentences(request, onChunk);
      }

      const result = await this.manager.synthesize(
        request.text,
        request.voice,
        request.streaming ?? false
      );

      const chunk: TTSChunk = {
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        sampleRate: result.sampleRate,
      };

      if (onChunk) {
        onChunk(chunk);
      }

      return chunk;
    } catch (error) {
      this.errorCount++;
      throw error;
    } finally {
      this._activeCount--;
    }
  }

  private async streamSentences(
    request: TTSRequest,
    onChunk: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    const sentences = splitIntoSentences(request.text);
    let lastChunk: TTSChunk | null = null;
    const segments = sentences.length > 0 ? sentences : [request.text];

    for (const sentence of segments) {
      const result = await this.manager.synthesize(
        sentence,
        request.voice,
        false
      );

      const chunk: TTSChunk = {
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        sampleRate: result.sampleRate,
      };

      onChunk(chunk);
      lastChunk = chunk;
    }

    if (!lastChunk) {
      const result = await this.manager.synthesize(
        request.text,
        request.voice,
        false
      );

      lastChunk = {
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        sampleRate: result.sampleRate,
      };

      onChunk(lastChunk);
    }

    return lastChunk;
  }

  getHealth(): ProcessHealth[] {
    // Return a single health entry for the in-process implementation
    return [
      {
        isHealthy: this.initialized,
        lastPing: this.initialized ? Date.now() : null,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      },
    ];
  }

  async shutdown(): Promise<void> {
    await this.manager.shutdown();
    this.initialized = false;
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
