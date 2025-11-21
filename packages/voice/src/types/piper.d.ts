// Type definitions for piper-wasm
declare module "@diffusionstudio/piper-wasm" {
  export class PiperTTS {
    constructor(opts?: {
      wasm?: string;
      worker?: string;
      logger?: (msg: string) => void;
    });
    synthesize(text: string): Promise<Float32Array>;
    load(voiceOrPath: string): Promise<void>;
    config?: {
      sample_rate?: number;
    } & Record<string, unknown>;
  }
}

declare module "piper-wasm" {
  export class PiperTTS {
    constructor(opts?: {
      wasm?: string;
      worker?: string;
      logger?: (msg: string) => void;
    });
    synthesize(text: string): Promise<Float32Array>;
    load(voiceOrPath: string): Promise<void>;
    config?: {
      sample_rate?: number;
    } & Record<string, unknown>;
  }
}
