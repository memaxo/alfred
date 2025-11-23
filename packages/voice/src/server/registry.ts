import { logger as globalLogger } from "@alfred/logger";
import type { STTPool } from "../process/stt";
import type { TTSPool } from "../process/tts";
import { type VoiceLogger, VoiceSession } from "./session";

const defaultLogger: VoiceLogger = globalLogger;

export class VoiceRegistry {
  private readonly sessions = new Map<string, VoiceSession>();
  private readonly sttPool: STTPool;
  private readonly ttsPool: TTSPool;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly logger: VoiceLogger;

  constructor(sttPool: STTPool, ttsPool: TTSPool, logger?: VoiceLogger) {
    this.sttPool = sttPool;
    this.ttsPool = ttsPool;
    this.logger = logger ?? defaultLogger;
    this.startCleanup();
  }

  createSession(
    userId: string,
    sessionId: string,
    language?: string
  ): VoiceSession {
    const session = new VoiceSession({
      userId,
      sessionId,
      language,
      sttPool: this.sttPool,
      ttsPool: this.ttsPool,
      logger: this.logger,
    });

    this.sessions.set(sessionId, session);
    session.activate();

    this.logger.info("voice_session_created", { userId, sessionId });

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
      this.logger.info("voice_session_removed", { sessionId });
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
    }, 60_000); // Check every minute
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

  getStats() {
    return {
      activeSessions: this.sessions.size,
      sttPool: {
        size: this.sttPool.size,
        active: this.sttPool.activeCount,
        health: this.sttPool.getHealth(),
      },
      ttsPool: {
        size: this.ttsPool.size,
        active: this.ttsPool.activeCount,
        health: this.ttsPool.getHealth(),
      },
    };
  }
}
