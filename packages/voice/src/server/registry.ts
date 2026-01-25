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
    const defaultChunkSize = (() => {
      const raw = (process.env.VOICE_STT_CHUNK_SIZE ?? "").toLowerCase();
      return raw === "fast" ||
        raw === "low" ||
        raw === "medium" ||
        raw === "accurate"
        ? (raw as "fast" | "low" | "medium" | "accurate")
        : undefined;
    })();

    const session = new VoiceSession({
      userId,
      sessionId,
      language,
      sttPool: this.sttPool,
      ttsPool: this.ttsPool,
      logger: this.logger,
      defaultChunkSize,
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

      const cleaned = this.sttPool.cleanupIdleSessions(timeoutMs);
      if (cleaned > 0) {
        this.logger.info("voice_stt_idle_sessions_cleaned", { cleaned });
      }
    }, 60_000).unref(); // Check every minute
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clearSessions();
  }

  clearSessions(): number {
    const ids = [...this.sessions.keys()];
    for (const sessionId of ids) {
      this.removeSession(sessionId);
    }
    return ids.length;
  }

  getStats() {
    const now = Date.now();
    return {
      generatedAt: now,
      activeSessions: this.sessions.size,
      sttPool: this.describePool(this.sttPool),
      ttsPool: this.describePool(this.ttsPool),
    };
  }

  private describePool(pool: STTPool | TTSPool) {
    const size = pool.size ?? 0;
    const active = pool.activeCount ?? 0;
    const utilization = size === 0 ? 0 : Math.min(1, active / size);
    return {
      size,
      active,
      utilization,
      health: pool.getHealth(),
    };
  }
}
