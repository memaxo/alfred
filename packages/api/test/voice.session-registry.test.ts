import { describe, expect, it } from "bun:test";
import {
  claimVoiceSession,
  completeVoiceSession,
  getVoiceSession,
  listVoiceSessions,
  markVoiceSessionError,
  releaseVoiceSession,
  updateVoiceSession,
} from "../src/voice/session-registry";

describe("voice session registry", () => {
  it("claims, updates, and completes sessions", () => {
    const claimed = claimVoiceSession({
      userId: "user-1",
      surface: "web",
      mode: "clip",
      codec: { input: "audio/webm", output: "mp3" },
    });
    expect(claimed.status).toBe("idle");
    updateVoiceSession(claimed.id, { status: "processing", lastTranscript: "hello" });
    const snapshot = getVoiceSession(claimed.id);
    expect(snapshot?.status).toBe("processing");
    expect(snapshot?.lastTranscript).toBe("hello");
    markVoiceSessionError(claimed.id, "boom");
    expect(getVoiceSession(claimed.id)?.status).toBe("error");
    completeVoiceSession(claimed.id, { lastAssistantText: "ok" });
    const sessions = listVoiceSessions("user-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("idle");
    expect(sessions[0].lastAssistantText).toBe("ok");
    releaseVoiceSession(claimed.id);
    expect(getVoiceSession(claimed.id)).toBeNull();
  });

  it("rejects conflicting claims", () => {
    const claimed = claimVoiceSession({
      userId: "user-1",
      sessionId: "session-1",
      mode: "clip",
    });
    expect(claimed.id).toBe("session-1");
    expect(() =>
      claimVoiceSession({
        userId: "user-2",
        sessionId: "session-1",
        mode: "clip",
      })
    ).toThrow("voice_session_conflict");
  });
});
