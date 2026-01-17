import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { logger as globalLogger } from "@alfred/logger";
import {
  recordVoiceStt,
  recordVoiceTts,
  voiceStreamLatencySeconds,
} from "../metrics";
import type { STTPool, STTResult } from "../process/stt";
import type { TTSPool } from "../process/tts";

export type VoiceLogger = {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
};

const defaultLogger: VoiceLogger = globalLogger;

export type VoiceSessionConfig = {
  userId: string;
  sessionId: string;
  language?: string;
  sttPool: STTPool;
  ttsPool: TTSPool;
  logger?: VoiceLogger;
};

export class VoiceSession {
  private readonly config: VoiceSessionConfig;
  private readonly audioBuffer: Buffer[] = [];
  private lastActivity: number = Date.now();
  private transcriptBuffer = "";
  private readonly logger: VoiceLogger;
  private readonly sttProvider: string;
  private readonly ttsProvider: string;

  constructor(config: VoiceSessionConfig) {
    this.config = config;
    this.logger = config.logger ?? defaultLogger;
    // Provider labels are inferred from env since pool internals are not exposed.
    // This is a limitation: actual provider may differ if pools are reconfigured.
    // Note: consider exposing provider from pool configuration for accurate labeling.
    this.sttProvider = "maya1";
    this.ttsProvider =
      process.env.TTS_PROVIDER === "supertonic" ? "supertonic" : "maya1";
  }

  async processAudioChunk(
    audioBase64: string,
    mimeType: string,
    options?: { vadThreshold?: number; sessionId?: string }
  ): Promise<STTResult | null> {
    this.lastActivity = Date.now();
    this.audioBuffer.push(Buffer.from(audioBase64, "base64"));

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

      if (result.text) {
        this.transcriptBuffer += `${result.text} `;
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

  async synthesizeText(text: string, voice?: string): Promise<Buffer[]> {
    this.lastActivity = Date.now();
    const audioChunks: Buffer[] = [];

    const timerStart = performance.now();
    try {
      await this.config.ttsPool.synthesize(
        {
          text,
          voice,
          streaming: true,
        },
        (chunk) => {
          audioChunks.push(Buffer.from(chunk.audioBase64, "base64"));
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
    const timerStart = performance.now();
    try {
      await this.config.ttsPool.synthesize(
        {
          text,
          voice,
          streaming: true,
        },
        (chunk) => {
          onChunk(Buffer.from(chunk.audioBase64, "base64"));
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

  isIdle(timeoutMs: number = 5 * 60 * 1000): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  activate(): void {
    this.lastActivity = Date.now();
  }

  deactivate(): void {
    // Session is deactivated (no-op for now, could add cleanup logic)
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
}
