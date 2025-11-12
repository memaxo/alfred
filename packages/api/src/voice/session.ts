import { STTPool } from "@alfred/voice/process/stt_pool";
import { TTSPool } from "@alfred/voice/process/tts_pool";
import { logger } from "../utils/logger";

export interface VoiceSessionConfig {
  userId: string;
  sessionId: string;
  language?: string;
  sttPool: STTPool;
  ttsPool: TTSPool;
}

export class VoiceSession {
  private config: VoiceSessionConfig;
  private audioBuffer: Buffer[] = [];
  private lastActivity: number = Date.now();
  private transcriptBuffer = "";

  constructor(config: VoiceSessionConfig) {
    this.config = config;
  }

  async processAudioChunk(audioBase64: string, mimeType: string): Promise<void> {
    this.lastActivity = Date.now();
    this.audioBuffer.push(Buffer.from(audioBase64, "base64"));

    // Process audio chunk for transcription
    try {
      const result = await this.config.sttPool.transcribe({
        audioBase64,
        mimeType,
        language: this.config.language,
        streaming: true,
      });

      if (result.text) {
        this.transcriptBuffer += result.text + " ";
      }
    } catch (error) {
      logger.error("voice_session_transcribe_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async synthesizeText(text: string, voice?: string): Promise<Buffer[]> {
    this.lastActivity = Date.now();
    const audioChunks: Buffer[] = [];

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
    } catch (error) {
      logger.error("voice_session_synthesize_error", {
        sessionId: this.config.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return audioChunks;
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
}

export class VoiceSessionManager {
  private sessions = new Map<string, VoiceSession>();
  private sttPool: STTPool;
  private ttsPool: TTSPool;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(sttPool: STTPool, ttsPool: TTSPool) {
    this.sttPool = sttPool;
    this.ttsPool = ttsPool;
    this.startCleanup();
  }

  createSession(userId: string, sessionId: string, language?: string): VoiceSession {
    const session = new VoiceSession({
      userId,
      sessionId,
      language,
      sttPool: this.sttPool,
      ttsPool: this.ttsPool,
    });

    this.sessions.set(sessionId, session);
    session.activate();

    logger.info("voice_session_created", { userId, sessionId });

    return session;
  }

  getSession(sessionId: string): VoiceSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.deactivate();
      this.sessions.delete(sessionId);
      logger.info("voice_session_removed", { sessionId });
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const timeoutMs = 5 * 60 * 1000; // 5 minutes

      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.isIdle(timeoutMs)) {
          this.removeSession(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const sessionId of this.sessions.keys()) {
      this.removeSession(sessionId);
    }
  }
}

