import type { HookContext, HookRegistry } from "@alfred/type";

import { logger as globalLogger } from "@alfred/logger";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";

import type { ChunkSize, STTPool, STTResult } from "../process/stt";
import type { TTSPool } from "../process/tts";

import {
  recordVoiceStt,
  recordVoiceTts,
  voiceStreamLatencySeconds,
} from "../metrics";

export interface VoiceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: VoiceLogger = globalLogger;

export interface VoiceSessionConfig {
  userId: string;
  sessionId: string;
  language?: string;
  sttPool: STTPool;
  ttsPool: TTSPool;
  logger?: VoiceLogger;
  /** Default chunk size for STT latency/accuracy tradeoff */
  defaultChunkSize?: ChunkSize;
  hooks?: {
    readonly registry: HookRegistry;
    readonly ctx: HookContext;
  };
}

export class VoiceSession {
  private readonly config: VoiceSessionConfig;
  private readonly audioBuffer: Buffer[] = [];
  private readonly createdAt = Date.now();
  private lastActivity: number = Date.now();
  private transcriptBuffer = "";
  private readonly logger: VoiceLogger;
  private readonly sttProvider: string;
  private readonly ttsProvider: string;

  private utteranceCount = 0;

  /** Track if we've cleared the STT cache for this session */
  private sttCacheCleared = false;

  /** Current chunk size setting */
  private chunkSize: ChunkSize;

  constructor(config: VoiceSessionConfig) {
    this.config = config;
    this.logger = config.logger ?? defaultLogger;
    this.chunkSize = config.defaultChunkSize ?? "medium";
    // Provider labels are inferred from env since pool internals are not exposed.
    this.sttProvider = "nemotron";
    this.ttsProvider =
      process.env.TTS_PROVIDER === "supertonic" ? "supertonic" : "maya1";
  }

  /**
   * Process an audio chunk for transcription.
   * Uses cache-aware streaming with session affinity.
   */
  async processAudioChunk(
    audioBase64: string,
    mimeType: string,
    options?: {
      vadThreshold?: number;
      sessionId?: string;
      chunkSize?: ChunkSize;
      clearCache?: boolean;
    }
  ): Promise<STTResult | null> {
    this.lastActivity = Date.now();
    const audioBuf = Buffer.from(audioBase64, "base64");
    this.audioBuffer.push(audioBuf);

    const { hooks } = this.config;
    if (hooks) {
      const sampleRate = mimeType.includes("pcm") ? 16_000 : 0;
      const audioLengthMs =
        sampleRate > 0
          ? Math.round((audioBuf.byteLength / 2 / sampleRate) * 1000)
          : 0;
      try {
        const out = await hooks.registry.emit(
          {
            type: "voice:stt:before",
            audioLengthMs,
            sampleRate,
          },
          hooks.ctx
        );
        if (out.decision === "deny" || out.decision === "ask") {
          return null;
        }
      } catch {
        // best-effort
      }
    }

    // Process audio chunk for transcription
    const timerStart = performance.now();
    try {
      const result = await this.config.sttPool.transcribe({
        audioBase64,
        mimeType,
        language: this.config.language,
        streaming: true,
        vadThreshold: options?.vadThreshold,
        sessionId: options?.sessionId ?? this.config.sessionId,
        chunkSize: options?.chunkSize ?? this.chunkSize,
        clearCache: options?.clearCache,
      });

      const wallSeconds = (performance.now() - timerStart) / 1000;
      const durationSeconds =
        typeof result.durationSeconds === "number"
          ? result.durationSeconds
          : wallSeconds;
      voiceStreamLatencySeconds.observe(
        { stage: "stt_stream_transcribe" },
        wallSeconds
      );
      recordVoiceStt({
        provider: this.sttProvider,
        status: "ok",
        durationSeconds,
      });

      const transcript = result.text;
      if (transcript) {
        let finalTranscript = transcript;

        if (hooks) {
          try {
            const confidence =
              typeof result.vadConfidence === "number"
                ? Math.max(0, Math.min(1, result.vadConfidence))
                : (transcript.trim().length > 0
                  ? 0.8
                  : 0);
            const out = await hooks.registry.emit(
              {
                type: "voice:stt:after",
                transcript,
                confidence,
                durationMs: Math.round(durationSeconds * 1000),
              },
              hooks.ctx
            );
            const t = out.transformed;
            if (
              t &&
              t.type === "voice:stt:after" &&
              typeof t.transcript === "string"
            ) {
              finalTranscript = t.transcript;
            }
          } catch {
            // best-effort
          }
        }

        if (finalTranscript.trim().length > 0) {
          this.utteranceCount++;
          this.transcriptBuffer += `${finalTranscript} `;
        }
      }
      return result;
    } catch (error) {
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "stt_stream_transcribe" },
        wallSeconds
      );
      recordVoiceStt({
        provider: this.sttProvider,
        status: "error",
        durationSeconds: wallSeconds,
      });
      this.logger.error("voice_session_transcribe_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear the STT cache for this session.
   * Call this when starting a new utterance or after errors.
   */
  async clearSttCache(): Promise<boolean> {
    try {
      const cleared = await this.config.sttPool.clearSessionCache(
        this.config.sessionId
      );
      this.sttCacheCleared = true;
      this.logger.info("voice_session_cache_cleared", {
        sessionId: this.config.sessionId,
        cleared,
      });
      return cleared;
    } catch (error) {
      this.logger.error("voice_session_cache_clear_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Set the chunk size for latency/accuracy tradeoff.
   */
  setChunkSize(size: ChunkSize): void {
    this.chunkSize = size;
    this.logger.info("voice_session_chunk_size_changed", {
      sessionId: this.config.sessionId,
      chunkSize: size,
    });
  }

  /**
   * Get current chunk size setting.
   */
  getChunkSize(): ChunkSize {
    return this.chunkSize;
  }

  async synthesizeText(text: string, voice?: string): Promise<Buffer[]> {
    this.lastActivity = Date.now();
    const audioChunks: Buffer[] = [];

    const { hooks } = this.config;
    let finalText = text;
    let finalVoice = voice;
    if (hooks) {
      try {
        const out = await hooks.registry.emit(
          { type: "voice:tts:before", text, voice },
          hooks.ctx
        );
        if (out.decision === "deny" || out.decision === "ask") {
          return [];
        }
        const t = out.transformed;
        if (t) {
          if (typeof t.text === "string") {
            finalText = t.text;
          }
          if (
            "voice" in t &&
            (t.voice === undefined || typeof t.voice === "string")
          ) {
            finalVoice = t.voice;
          }
        }
      } catch {
        // best-effort
      }
    }

    let outBytes = 0;
    let outSampleRate = 24_000;

    const timerStart = performance.now();
    try {
      await this.config.ttsPool.synthesize(
        {
          text: finalText,
          voice: finalVoice,
          streaming: true,
        },
        (chunk) => {
          outSampleRate = chunk.sampleRate ?? outSampleRate;
          const buf = Buffer.from(chunk.audioBase64, "base64");
          outBytes += buf.byteLength;
          audioChunks.push(buf);
        }
      );
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "tts_stream_synthesize" },
        wallSeconds
      );
      recordVoiceTts({
        provider: this.ttsProvider,
        status: "ok",
        durationSeconds: wallSeconds,
      });

      if (hooks) {
        try {
          const audioLengthMs =
            outBytes > 0
              ? Math.round((outBytes / 2 / outSampleRate) * 1000)
              : 0;
          await hooks.registry.emit(
            {
              type: "voice:tts:after",
              text: finalText,
              audioLengthMs,
              durationMs: Math.round(wallSeconds * 1000),
            },
            hooks.ctx
          );
        } catch {
          // best-effort
        }
      }
    } catch (error) {
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "tts_stream_synthesize" },
        wallSeconds
      );
      recordVoiceTts({
        provider: this.ttsProvider,
        status: "error",
        durationSeconds: wallSeconds,
      });
      this.logger.error("voice_session_synthesize_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return audioChunks;
  }

  async streamSynthesis(
    text: string,
    voice: string | undefined,
    onChunk: (chunk: Buffer) => void
  ): Promise<void> {
    this.lastActivity = Date.now();

    const { hooks } = this.config;
    let finalText = text;
    let finalVoice = voice;
    if (hooks) {
      try {
        const out = await hooks.registry.emit(
          { type: "voice:tts:before", text, voice },
          hooks.ctx
        );
        if (out.decision === "deny" || out.decision === "ask") {
          return;
        }
        const t = out.transformed;
        if (t) {
          if (typeof t.text === "string") {
            finalText = t.text;
          }
          if (
            "voice" in t &&
            (t.voice === undefined || typeof t.voice === "string")
          ) {
            finalVoice = t.voice;
          }
        }
      } catch {
        // best-effort
      }
    }

    let outBytes = 0;
    let outSampleRate = 24_000;
    const timerStart = performance.now();
    try {
      await this.config.ttsPool.synthesize(
        {
          text: finalText,
          voice: finalVoice,
          streaming: true,
        },
        (chunk) => {
          outSampleRate = chunk.sampleRate ?? outSampleRate;
          const buf = Buffer.from(chunk.audioBase64, "base64");
          outBytes += buf.byteLength;
          onChunk(buf);
        }
      );
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "tts_stream_synthesize" },
        wallSeconds
      );
      recordVoiceTts({
        provider: this.ttsProvider,
        status: "ok",
        durationSeconds: wallSeconds,
      });

      if (hooks) {
        try {
          const audioLengthMs =
            outBytes > 0
              ? Math.round((outBytes / 2 / outSampleRate) * 1000)
              : 0;
          await hooks.registry.emit(
            {
              type: "voice:tts:after",
              text: finalText,
              audioLengthMs,
              durationMs: Math.round(wallSeconds * 1000),
            },
            hooks.ctx
          );
        } catch {
          // best-effort
        }
      }
    } catch (error) {
      const wallSeconds = (performance.now() - timerStart) / 1000;
      voiceStreamLatencySeconds.observe(
        { stage: "tts_stream_synthesize" },
        wallSeconds
      );
      recordVoiceTts({
        provider: this.ttsProvider,
        status: "error",
        durationSeconds: wallSeconds,
      });
      this.logger.error("voice_session_stream_synthesis_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getTranscript(): string {
    return this.transcriptBuffer.trim();
  }

  clearTranscript(): void {
    this.transcriptBuffer = "";
  }

  clearAudio(): void {
    this.audioBuffer.length = 0;
  }

  /**
   * Reset per-utterance buffers while keeping session identity.
   * Call this after an utterance completes.
   */
  clearUtterance(): void {
    this.clearTranscript();
    this.clearAudio();
    this.sttCacheCleared = false;
  }

  isIdle(timeoutMs: number = 5 * 60 * 1000): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  activate(): void {
    this.lastActivity = Date.now();
    // Clear STT cache on activation for fresh start
    this.sttCacheCleared = false;

    const { hooks } = this.config;
    if (hooks) {
      void hooks.registry
        .emit(
          {
            type: "voice:session:start",
            voiceSessionId: this.config.sessionId,
            device: undefined,
          },
          hooks.ctx
        )
        .catch(() => {});
    }
  }

  /**
   * Deactivate session and cleanup resources.
   *
   * This must be synchronous so call sites can safely perform cleanup
   * without leaking unhandled promises during shutdown paths.
   */
  deactivate(): void {
    // Release session affinity in the STT pool
    this.config.sttPool.releaseSession(this.config.sessionId);
    this.logger.info("voice_session_deactivated", {
      sessionId: this.config.sessionId,
    });

    const { hooks } = this.config;
    if (hooks) {
      void hooks.registry
        .emit(
          {
            type: "voice:session:end",
            voiceSessionId: this.config.sessionId,
            durationMs: Math.max(0, Date.now() - this.createdAt),
            utteranceCount: this.utteranceCount,
          },
          hooks.ctx
        )
        .catch(() => {});
    }
  }

  getSessionId(): string {
    return this.config.sessionId;
  }

  getUserId(): string {
    return this.config.userId;
  }

  getLastActivity(): number {
    return this.lastActivity;
  }

  /**
   * Get session state for debugging/telemetry.
   */
  getState(): {
    sessionId: string;
    userId: string;
    lastActivity: number;
    transcriptLength: number;
    audioChunksBuffered: number;
    chunkSize: ChunkSize;
    sttCacheCleared: boolean;
  } {
    return {
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      lastActivity: this.lastActivity,
      transcriptLength: this.transcriptBuffer.length,
      audioChunksBuffered: this.audioBuffer.length,
      chunkSize: this.chunkSize,
      sttCacheCleared: this.sttCacheCleared,
    };
  }
}
