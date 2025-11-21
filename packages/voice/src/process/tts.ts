import { join } from "node:path";
import { ModelProcess, type ProcessConfig } from "./base";
import { MayaTTSProcess } from "./maya";
import { SupertonicTTS } from "./supertonic";

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
    process: ModelProcess;
    wrapper: MayaTTSProcess;
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
    // Check if we should use Supertonic
    // We can use an environment variable or check the config
    // For now, let's assume if TTS_PROVIDER is "supertonic", we use it.
    // The config passed here usually comes from pools.ts which reads env vars.
    // However, ProcessConfig doesn't have a provider field.
    // We can inspect process.env directly or expect config to have been adjusted.
    this.useSupertonic = process.env.TTS_PROVIDER === "supertonic";
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
        // Try packages/voice/models/supertonic first (monorepo root)
        // Then models/supertonic (package root)
        let modelsDir = join(process.cwd(), "packages/voice/models/supertonic");

        if (process.cwd().endsWith("packages/voice")) {
          modelsDir = join(process.cwd(), "models/supertonic");
        }

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
        // Update script path to point to maya_tts.py
        const processConfig = {
          ...this.config,
          scriptPath: this.config.scriptPath.replace(
            "piper_tts.py",
            "maya_tts.py"
          ),
        };

        const proc = new ModelProcess(processConfig);
        await proc.start();
        const wrapper = new MayaTTSProcess(proc);

        this.processes.push({
          process: proc,
          wrapper,
          active: false,
        });
      }
      this.initialized = true;
    } catch (error) {
      // Clean up any started processes
      await this.shutdown();
      throw new Error(
        `Failed to initialize TTS pool: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getNextAvailable(): {
    process: ModelProcess;
    wrapper: MayaTTSProcess;
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
        // Supertonic doesn't support streaming callbacks in the same way yet (it has progress callback)
        // But our port doesn't yield audio chunks yet, it returns full audio.
        // For now, we return the full result.
        // TODO: Implement streaming in SupertonicTTS if needed.

        const result = await this.supertonic.synthesize(request.text, {
          speed: 1.05,
          voice: request.voice,
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

        if (onChunk) {
          onChunk(chunk);
        }

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
    if (this.useSupertonic) {
      this.supertonic = null;
    } else {
      await Promise.all(this.processes.map((p) => p.process.shutdown()));
      this.processes = [];
    }
    this.initialized = false;
  }
}
