import { join } from "node:path";
import { Process, type ProcessConfig, resolveVoiceDir } from "./base";
import { Maya } from "./maya";
import type { SupertonicTTS } from "./supertonic";

// Re-export ProcessConfig for use in other packages
export type { ProcessConfig };

export type TTSRequest = {
  text: string;
  voice?: string;
  streaming?: boolean;
};

export type TTSChunk = {
  audioBase64: string;
  mimeType: string;
  sampleRate?: number;
};

export type ProcessHealth = {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
};

export class TTSPool {
  private processes: Array<{
    process: Process;
    wrapper: Maya;
    active: boolean;
  }> = [];
  private supertonic: SupertonicTTS | null = null;
  private readonly config: ProcessConfig;
  private readonly poolSize: number;
  private _activeCount = 0;
  private initialized = false;
  private readonly useSupertonic: boolean;

  constructor(config: ProcessConfig, poolSize = 2) {
    this.config = config;
    this.poolSize = poolSize;
    // Determine TTS provider: explicit env var > implied by voice provider
    // Note: pools.ts sets TTS_PROVIDER="supertonic" if VOICE_PROVIDER="supertonic"
    const ttsProvider = process.env.TTS_PROVIDER;
    this.useSupertonic = ttsProvider === "supertonic";
  }

  get size(): number {
    return this.useSupertonic ? 1 : this.poolSize;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (this.useSupertonic) {
        // Initialize Supertonic (in-process)
        const voiceDir = resolveVoiceDir();
        const modelsDir = join(voiceDir, "models/supertonic");

        const { SupertonicTTS } = await import("./supertonic");
        this.supertonic = new SupertonicTTS({
          modelPath: modelsDir,
          defaultVoice: "M1.json", // Default to Male 1
        });
        await this.supertonic.initialize();
        this.initialized = true;
        return;
      }

      // Initialize pool of processes (Maya1)
      for (let i = 0; i < this.poolSize; i++) {
        // Legacy path replacement logic removed.
        // We now assume scriptPath points to the correct directory or file.
        // If scriptPath is a directory (packages/voice/python/tts), __main__.py is used.
        const processConfig = {
          ...this.config,
          env: {
            ...this.config.env,
            // Increase node/uv timeout for large model initialization
            UV_HTTP_TIMEOUT: "300",
          },
          // 60s timeout for IPC requests (Maya1 generation can be slow)
          requestTimeoutMs: 60_000,
        };

        const proc = new Process(processConfig);
        await proc.start();
        const wrapper = new Maya(proc);

        this.processes.push({
          process: proc,
          wrapper,
          active: false,
        });
      }
      this.initialized = true;

      // Warmup all processes in parallel
      if (!this.useSupertonic) {
        // Don't await warmup to avoid blocking initialization
        this.warmup().catch((_err) => {});
      }
    } catch (error) {
      // Clean up any started processes
      await this.shutdown();
      throw new Error(
        `Failed to initialize TTS pool: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async warmup(): Promise<void> {
    const warmupRequest: TTSRequest = {
      text: "Warmup", // Short text
      voice: "default",
      streaming: false,
    };

    await Promise.all(
      this.processes.map(async (p) => {
        try {
          // Send warmup request but don't use the audio
          await p.wrapper.synthesize(warmupRequest);
        } catch (_e) {
          // Ignore warmup errors
        }
      })
    );
  }

  private getNextAvailable(): {
    process: Process;
    wrapper: Maya;
    index: number;
  } {
    // Simple round-robin or first available
    const availableIndex = this.processes.findIndex((p) => !p.active);
    if (availableIndex >= 0) {
      const p = this.processes[availableIndex];
      if (!p) {
        throw new Error(`Process not found at index ${availableIndex}`);
      }
      p.active = true;
      return { process: p.process, wrapper: p.wrapper, index: availableIndex };
    }

    const index = Math.floor(Math.random() * this.processes.length);
    const p = this.processes[index];
    if (!p) {
      throw new Error(`Process not found at index ${index}`);
    }
    return { process: p.process, wrapper: p.wrapper, index };
  }

  async synthesize(
    request: TTSRequest,
    onChunk?: (chunk: TTSChunk) => void
  ): Promise<TTSChunk> {
    if (!this.initialized) {
      await this.initialize();
    }

    this._activeCount++;

    try {
      if (this.useSupertonic && this.supertonic) {
        const result = await this.supertonic.synthesize(request.text, {
          speed: 1.05,
          voice: request.voice,
          onChunk: onChunk
            ? (rawChunk) => {
                const float32 = rawChunk.audio;
                const int16 = new Int16Array(float32.length);
                for (let i = 0; i < float32.length; i++) {
                  const val = float32[i];
                  if (val !== undefined) {
                    const s = Math.max(-1, Math.min(1, val));
                    int16[i] = s < 0 ? s * 0x80_00 : s * 0x7f_ff;
                  }
                }
                const audioBase64 = Buffer.from(int16.buffer).toString(
                  "base64"
                );
                onChunk({
                  audioBase64,
                  mimeType: "audio/pcm",
                  sampleRate: rawChunk.sampleRate,
                });
              }
            : undefined,
        });

        // Convert Float32Array to Base64 (PCM 16-bit)
        // Supertonic output is Float32 [-1, 1]
        const float32 = result.audio;
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const val = float32[i];
          if (val === undefined) {
            continue;
          }
          const s = Math.max(-1, Math.min(1, val));
          int16[i] = s < 0 ? s * 0x80_00 : s * 0x7f_ff;
        }
        const audioBase64 = Buffer.from(int16.buffer).toString("base64");

        const chunk: TTSChunk = {
          audioBase64,
          mimeType: "audio/pcm",
          sampleRate: result.sampleRate ?? 24_000,
        };

        return chunk;
      }

      const { wrapper, index } = this.getNextAvailable();

      try {
        return await wrapper.synthesize(request, onChunk);
      } finally {
        const p = this.processes[index];
        if (p) {
          p.active = false;
        }
      }
    } finally {
      this._activeCount--;
    }
  }

  getHealth(): ProcessHealth[] {
    if (this.useSupertonic) {
      return [
        {
          isHealthy: this.initialized,
          lastPing: Date.now(),
          requestCount: 0, // TODO: track stats
          errorCount: 0,
          uptime: 0,
        },
      ];
    }
    return this.processes.map((p) => p.process.getHealth());
  }

  async shutdown(): Promise<void> {
    if (this.useSupertonic && this.supertonic) {
      await this.supertonic.shutdown();
      this.supertonic = null;
    } else {
      await Promise.all(this.processes.map((p) => p.process.shutdown()));
      this.processes = [];
    }
    this.initialized = false;
  }
}
