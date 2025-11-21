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
  it("claims, updates, and completes sessions", async () => {
    const claimed = await claimVoiceSession({
      userId: "user-1",
      surface: "web",
      mode: "clip",
      codec: { input: "audio/webm", output: "mp3" },
    });
    expect(claimed.status).toBe("idle");
    await updateVoiceSession(claimed.id, {
      status: "processing",
      lastTranscript: "hello",
    });
    const snapshot = await getVoiceSession(claimed.id);
    expect(snapshot?.status).toBe("processing");
    expect(snapshot?.lastTranscript).toBe("hello");
    await markVoiceSessionError(claimed.id, "boom");
    expect((await getVoiceSession(claimed.id))?.status).toBe("error");
    await completeVoiceSession(claimed.id, { lastAssistantText: "ok" });
    const sessions = await listVoiceSessions("user-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("idle");
    expect(sessions[0].lastAssistantText).toBe("ok");
    await releaseVoiceSession(claimed.id);
    expect(await getVoiceSession(claimed.id)).toBeNull();
  });

  it("rejects conflicting claims", async () => {
    const claimed = await claimVoiceSession({
      userId: "user-1",
      sessionId: "session-1",
      mode: "clip",
    });
    expect(claimed.id).toBe("session-1");
    expect(
      async () =>
        await claimVoiceSession({
          userId: "user-2",
          sessionId: "session-1",
          mode: "clip",
        })
    ).toThrow("voice_session_conflict");
  });
});
