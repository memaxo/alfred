import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import type {
  VoiceControlInput,
  VoiceStatusInput,
} from "../assistant/src/tool/voice";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

const mockGetVoiceSession = mock();
const mockListVoiceSessions = mock();
const mockUpdateVoiceSession = mock();

mock.module("@alfred/api/voice/session-registry", () => ({
  getVoiceSession: mockGetVoiceSession,
  listVoiceSessions: mockListVoiceSessions,
  updateVoiceSession: mockUpdateVoiceSession,
}));

// Import tools after mocking
const { toolVoiceStatus, toolVoiceControl } = await import(
  "../assistant/src/tool/voice"
);

describe("Voice Tools", () => {
  beforeEach(() => {
    authTokenMocks.requireToolScopesAndPolicy.mockReset();
    mockGetVoiceSession.mockReset();
    mockListVoiceSessions.mockReset();
    mockUpdateVoiceSession.mockReset();

    // Default to allowing all policy checks
    authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["voice.read", "voice.write"],
      },
    });
  });

  describe("voice_status", () => {
    it("returns status for specific session", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "recording",
        createdAt: 1000,
        updatedAt: 1500,
        lastTranscript: "Hello world",
      };

      mockGetVoiceSession.mockResolvedValue(session);

      const input: VoiceStatusInput = {
        userId: "user-1",
        sessionId: "session-1",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceStatus.execute({ input });

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionId).toBe("session-1");
      expect(result.sessions[0].status).toBe("recording");
      expect(result.sessions[0].lastTranscript).toBe("Hello world");
    });

    it("returns all sessions for user when sessionId omitted", async () => {
      const sessions = [
        {
          id: "session-1",
          userId: "user-1",
          surface: "web",
          mode: "stream",
          status: "recording",
          createdAt: 1000,
          updatedAt: 1500,
        },
        {
          id: "session-2",
          userId: "user-1",
          surface: "native",
          mode: "clip",
          status: "idle",
          createdAt: 2000,
          updatedAt: 2500,
        },
      ];

      mockListVoiceSessions.mockResolvedValue(sessions);

      const input: VoiceStatusInput = {
        userId: "user-1",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceStatus.execute({ input });

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].sessionId).toBe("session-1");
      expect(result.sessions[1].sessionId).toBe("session-2");
    });

    it("returns empty array when session not found", async () => {
      mockGetVoiceSession.mockResolvedValue(null);

      const input: VoiceStatusInput = {
        userId: "user-1",
        sessionId: "non-existent",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceStatus.execute({ input });

      expect(result.sessions).toHaveLength(0);
    });

    it("enforces voice.read policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: VoiceStatusInput = {
        userId: "user-1",
      };

      await expect(toolVoiceStatus.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });
  });

  describe("voice_control", () => {
    it("pauses session by setting status to idle", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "recording",
        createdAt: 1000,
        updatedAt: 1500,
      };

      const updatedSession = {
        ...session,
        status: "idle",
        updatedAt: 2000,
      };

      mockGetVoiceSession.mockResolvedValue(session);
      mockUpdateVoiceSession.mockResolvedValue(updatedSession);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "pause",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceControl.execute({ input });

      expect(result.success).toBe(true);
      expect(result.action).toBe("pause");
      expect(result.newStatus).toBe("idle");
      expect(mockUpdateVoiceSession).toHaveBeenCalledWith("session-1", {
        status: "idle",
      });
    });

    it("resumes session by setting status to recording", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "idle",
        createdAt: 1000,
        updatedAt: 1500,
      };

      const updatedSession = {
        ...session,
        status: "recording",
        updatedAt: 2000,
      };

      mockGetVoiceSession.mockResolvedValue(session);
      mockUpdateVoiceSession.mockResolvedValue(updatedSession);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "resume",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceControl.execute({ input });

      expect(result.success).toBe(true);
      expect(result.action).toBe("resume");
      expect(result.newStatus).toBe("recording");
      expect(mockUpdateVoiceSession).toHaveBeenCalledWith("session-1", {
        status: "recording",
      });
    });

    it("interrupts session by clearing transcript and setting to idle", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "responding",
        createdAt: 1000,
        updatedAt: 1500,
        lastTranscript: "Hello world",
      };

      const updatedSession = {
        ...session,
        status: "idle",
        lastTranscript: undefined,
        updatedAt: 2000,
      };

      mockGetVoiceSession.mockResolvedValue(session);
      mockUpdateVoiceSession.mockResolvedValue(updatedSession);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "interrupt",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceControl.execute({ input });

      expect(result.success).toBe(true);
      expect(result.action).toBe("interrupt");
      expect(mockUpdateVoiceSession).toHaveBeenCalledWith("session-1", {
        status: "idle",
        lastTranscript: undefined,
      });
    });

    it("stops session by setting status to idle", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "recording",
        createdAt: 1000,
        updatedAt: 1500,
      };

      const updatedSession = {
        ...session,
        status: "idle",
        updatedAt: 2000,
      };

      mockGetVoiceSession.mockResolvedValue(session);
      mockUpdateVoiceSession.mockResolvedValue(updatedSession);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "stop",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceControl.execute({ input });

      expect(result.success).toBe(true);
      expect(result.action).toBe("stop");
      expect(mockUpdateVoiceSession).toHaveBeenCalledWith("session-1", {
        status: "idle",
      });
    });

    it("throws error when session not found", async () => {
      mockGetVoiceSession.mockResolvedValue(null);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "non-existent",
        action: "pause",
        authz: "Bearer test-token",
      };

      await expect(toolVoiceControl.execute({ input })).rejects.toThrow(
        "voice_session_not_found"
      );
    });

    it("throws error when user doesn't own session", async () => {
      const session = {
        id: "session-1",
        userId: "other-user",
        surface: "web",
        mode: "stream",
        status: "recording",
        createdAt: 1000,
        updatedAt: 1500,
      };

      mockGetVoiceSession.mockResolvedValue(session);

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "pause",
        authz: "Bearer test-token",
      };

      await expect(toolVoiceControl.execute({ input })).rejects.toThrow(
        "voice_session_unauthorized"
      );
    });

    it("enforces voice.write policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "pause",
      };

      await expect(toolVoiceControl.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });

    it("handles update failure gracefully", async () => {
      const session = {
        id: "session-1",
        userId: "user-1",
        surface: "web",
        mode: "stream",
        status: "recording",
        createdAt: 1000,
        updatedAt: 1500,
      };

      mockGetVoiceSession.mockResolvedValue(session);
      mockUpdateVoiceSession.mockResolvedValue(null); // Update fails

      const input: VoiceControlInput = {
        userId: "user-1",
        sessionId: "session-1",
        action: "pause",
        authz: "Bearer test-token",
      };

      const result = await toolVoiceControl.execute({ input });

      // Should still return success but with undefined newStatus
      expect(result.success).toBe(true);
      expect(result.newStatus).toBeUndefined();
    });

    it("handles all status transitions", async () => {
      const statuses: Array<
        "idle" | "recording" | "processing" | "responding" | "error"
      > = ["idle", "recording", "processing", "responding", "error"];

      for (const status of statuses) {
        const session = {
          id: "session-1",
          userId: "user-1",
          surface: "web",
          mode: "stream",
          status,
          createdAt: 1000,
          updatedAt: 1500,
        };

        const updatedSession = {
          ...session,
          status: "idle" as const,
          updatedAt: 2000,
        };

        mockGetVoiceSession.mockReset();
        mockUpdateVoiceSession.mockReset();
        mockGetVoiceSession.mockResolvedValue(session);
        mockUpdateVoiceSession.mockResolvedValue(updatedSession);

        const input: VoiceControlInput = {
          userId: "user-1",
          sessionId: "session-1",
          action: "pause",
          authz: "Bearer test-token",
        };

        const result = await toolVoiceControl.execute({ input });
        expect(result.success).toBe(true);
        expect(result.newStatus).toBe("idle");
      }
    });
  });

  describe("Schema Validation", () => {
    describe("voice_status", () => {
      it("requires userId", () => {
        const invalid = {};
        const result = toolVoiceStatus.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("requires non-empty userId", () => {
        const invalid = { userId: "" };
        const result = toolVoiceStatus.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("accepts optional sessionId", () => {
        const result = toolVoiceStatus.inputSchema.safeParse({
          userId: "user-1",
        });
        expect(result.success).toBe(true);
      });

      it("accepts optional authz token", () => {
        const result = toolVoiceStatus.inputSchema.safeParse({
          userId: "user-1",
          authz: "Bearer token",
        });
        expect(result.success).toBe(true);
      });

      it("validates output schema structure", async () => {
        mockListVoiceSessions.mockResolvedValue([]);

        const input: VoiceStatusInput = {
          userId: "user-1",
          authz: "Bearer test-token",
        };

        const result = await toolVoiceStatus.execute({ input });

        // Validate output matches schema
        const outputValidation = toolVoiceStatus.outputSchema.safeParse(result);
        expect(outputValidation.success).toBe(true);
        if (outputValidation.success) {
          expect(Array.isArray(outputValidation.data.sessions)).toBe(true);
        }
      });
    });

    describe("voice_control", () => {
      it("requires userId", () => {
        const invalid = { sessionId: "session-1", action: "pause" };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("requires sessionId", () => {
        const invalid = { userId: "user-1", action: "pause" };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("requires action", () => {
        const invalid = { userId: "user-1", sessionId: "session-1" };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("requires non-empty userId", () => {
        const invalid = {
          userId: "",
          sessionId: "session-1",
          action: "pause",
        };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("requires non-empty sessionId", () => {
        const invalid = {
          userId: "user-1",
          sessionId: "",
          action: "pause",
        };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("accepts valid action enum values", () => {
        const validActions = ["pause", "resume", "interrupt", "stop"];
        for (const action of validActions) {
          const result = toolVoiceControl.inputSchema.safeParse({
            userId: "user-1",
            sessionId: "session-1",
            action,
          });
          expect(result.success).toBe(true);
        }
      });

      it("rejects invalid action values", () => {
        const invalid = {
          userId: "user-1",
          sessionId: "session-1",
          action: "invalid",
        };
        const result = toolVoiceControl.inputSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("accepts optional authz token", () => {
        const result = toolVoiceControl.inputSchema.safeParse({
          userId: "user-1",
          sessionId: "session-1",
          action: "pause",
          authz: "Bearer token",
        });
        expect(result.success).toBe(true);
      });

      it("validates output schema structure", async () => {
        const session = {
          id: "session-1",
          userId: "user-1",
          surface: "web",
          mode: "stream",
          status: "recording",
          createdAt: 1000,
          updatedAt: 1500,
        };

        const updatedSession = {
          ...session,
          status: "idle" as const,
          updatedAt: 2000,
        };

        mockGetVoiceSession.mockResolvedValue(session);
        mockUpdateVoiceSession.mockResolvedValue(updatedSession);

        const input: VoiceControlInput = {
          userId: "user-1",
          sessionId: "session-1",
          action: "pause",
          authz: "Bearer test-token",
        };

        const result = await toolVoiceControl.execute({ input });

        // Validate output matches schema
        const outputValidation =
          toolVoiceControl.outputSchema.safeParse(result);
        expect(outputValidation.success).toBe(true);
        if (outputValidation.success) {
          expect(outputValidation.data.success).toBe(true);
          expect(outputValidation.data.sessionId).toBe("session-1");
          expect(outputValidation.data.action).toBe("pause");
        }
      });
    });
  });
});

afterAll(() => {
  mock.restore();
});
