import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Buffer } from "node:buffer";

// Type definitions for Piper WASM
interface PiperTTSInstance {
  synthesize(text: string): Promise<Float32Array> | Float32Array;
  load(voiceOrPath: string): Promise<void>;
  config?: {
    sample_rate?: number;
  };
}

interface PiperTTSConstructor {
  new (): PiperTTSInstance;
}

// Dynamic import to handle package availability
let PiperTTS: PiperTTSConstructor | null = null;

async function loadPiperWasm(): Promise<PiperTTSConstructor> {
  if (PiperTTS) {
    return PiperTTS;
  }

  try {
    // Try @diffusionstudio/piper-wasm first (recommended)
    const module = await import("@diffusionstudio/piper-wasm");
    PiperTTS = (module.PiperTTS || module.default || module) as PiperTTSConstructor;
    if (!PiperTTS) {
      throw new Error("PiperTTS class not found in module");
    }
    return PiperTTS;
  } catch (error) {
    // Fallback to piper-wasm if available
    try {
      const module = await import("piper-wasm");
      PiperTTS = (module.PiperTTS || module.default || module) as PiperTTSConstructor;
      if (!PiperTTS) {
        throw new Error("PiperTTS class not found in fallback module");
      }
      return PiperTTS;
    } catch (fallbackError) {
      throw new Error(
        `Piper WASM package not found. Install with: bun add @diffusionstudio/piper-wasm\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}\n` +
        `Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      );
    }
  }
}

export interface PiperTTSConfig {
  modelPath: string;
  defaultVoice: string;
}

export interface SynthesisResult {
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
}

export class PiperTTSManager {
  private config: PiperTTSConfig;
  private voices = new Map<string, PiperTTSInstance>();
  private piperTTS: PiperTTSConstructor | null = null;
  private initialized = false;
  private defaultSampleRate = 22050; // Fallback sample rate

  constructor(config: PiperTTSConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.piperTTS = await loadPiperWasm();
      // Pre-load default voice
      await this.loadVoice(this.config.defaultVoice);
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Piper TTS: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async loadVoice(voice: string): Promise<PiperTTSInstance> {
    if (this.voices.has(voice)) {
      return this.voices.get(voice)!;
    }

    if (!this.piperTTS) {
      throw new Error("Piper TTS not initialized. Call initialize() first.");
    }

    const voicePath = join(this.config.modelPath, `${voice}.onnx`);
    const configPath = join(this.config.modelPath, `${voice}.onnx.json`);

    // Verify files exist
    try {
      await readFile(voicePath);
      const configData = await readFile(configPath, "utf-8");
      const config = JSON.parse(configData);
      if (config.audio?.sample_rate) {
        this.defaultSampleRate = config.audio.sample_rate;
      }
    } catch (error) {
      throw new Error(
        `Voice model not found: ${voice}\n` +
        `Expected files:\n` +
        `  ${voicePath}\n` +
        `  ${configPath}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      const tts = new this.piperTTS();
      // Try loading from local path first, fallback to voice name (for Hugging Face download)
      try {
        await tts.load(voicePath);
      } catch {
        // If local path fails, try voice name (package might download from Hugging Face)
        await tts.load(voice);
      }
      this.voices.set(voice, tts);
      return tts;
    } catch (error) {
      throw new Error(
        `Failed to load voice ${voice}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private splitIntoSentences(text: string): string[] {
    if (!text) {
      return [];
    }
    return text
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  async synthesize(
    text: string,
    voice?: string,
    streaming = false
  ): Promise<SynthesisResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const targetVoice = voice ?? this.config.defaultVoice;
    let model: PiperVoice;

    try {
      model = await this.loadVoice(targetVoice);
    } catch (error) {
      // Fallback to default voice if specific voice fails
      if (targetVoice !== this.config.defaultVoice) {
        console.warn(
          `[voice] Voice ${targetVoice} failed, falling back to ${this.config.defaultVoice}`
        );
        model = await this.loadVoice(this.config.defaultVoice);
      } else {
        throw error;
      }
    }

    const startTime = Date.now();

    // Split into sentences for streaming
    const sentences = this.splitIntoSentences(text);

    // Collect all audio chunks
    const audioChunks: Float32Array[] = [];

    if (streaming && sentences.length > 1) {
      // Stream sentence by sentence
      for (const sentence of sentences) {
        if (!sentence.trim()) {
          continue;
        }
        const result = await model.synthesize(sentence);
        const audio = result instanceof Promise ? await result : result;
        audioChunks.push(audio);
      }
    } else {
      // Single synthesis
      const result = await model.synthesize(text);
      const audio = result instanceof Promise ? await result : result;
      audioChunks.push(audio);
    }

    // Combine all audio chunks
    let totalLength = 0;
    for (const chunk of audioChunks) {
      totalLength += chunk.length;
    }

    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert Float32Array to Int16Array PCM
    const pcm16 = new Int16Array(combinedAudio.length);
    for (let i = 0; i < combinedAudio.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, combinedAudio[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    // Convert to base64
    const audioBytes = Buffer.from(pcm16.buffer);
    const audioBase64 = audioBytes.toString("base64");

    const duration = Date.now() - startTime;
    const sampleRate = model.config?.sample_rate ?? this.defaultSampleRate;

    // Log performance metrics
    console.debug(
      `[voice] TTS synthesis: ${duration}ms, ${pcm16.length} samples, ${text.length} chars, voice: ${targetVoice}`
    );

    return {
      audioBase64,
      mimeType: "audio/pcm",
      sampleRate,
    };
  }

  getLoadedVoices(): string[] {
    return Array.from(this.voices.keys());
  }

  async shutdown(): Promise<void> {
    this.voices.clear();
    this.initialized = false;
  }
}

