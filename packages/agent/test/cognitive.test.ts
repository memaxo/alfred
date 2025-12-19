import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import type { CognitiveStateInput } from "../src/orchestrator/tool/cognitive";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

const mockGetLatestSnapshot = mock();
const mockGetEventsSince = mock();
const mockGetAllEvents = mock();
mock.module("@alfred/db", () => ({
  cognitiveRepo: {
    getLatestSnapshot: mockGetLatestSnapshot,
    getEventsSince: mockGetEventsSince,
    getAllEvents: mockGetAllEvents,
  },
}));

// Note: Pure functions (idle, initialAutonomy, applyTransition, unwrapEventEnvelope)
// are NOT mocked - we use real implementations to test actual behavior

// Import tool after mocking
const { toolCognitiveState } = await import(
  "../src/orchestrator/tool/cognitive"
);

describe("Cognitive State Tool", () => {
  beforeEach(() => {
    authTokenMocks.requireToolScopesAndPolicy.mockReset();
    mockGetLatestSnapshot.mockReset();
    mockGetEventsSince.mockReset();
    mockGetAllEvents.mockReset();

    // Default to allowing all policy checks
    authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["cognitive.read"],
      },
    });
  });

  describe("cognitive_state", () => {
    it("returns current state from snapshot without events", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "thinking",
          about: "test query",
          depth: 1,
          paths: [],
          started: 2000,
          physiology: { energy: 0.7, boredom: 0.3, frustration: 0.2 },
          autonomy: {
            level: 0.6,
            confidence: 0.8,
            prior: { alpha: 2, beta: 1 },
            evidence: [],
            constraints: [],
            lastUpdate: 2000,
          },
        },
        lastEventId: "event-1",
        createdAt: new Date(2000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      expect(result.state).toBe("thinking");
      expect(result.physiology.energy).toBe(0.7);
      expect(result.autonomy.level).toBe(0.6);
      expect(result.since).toBe(2000);
    });

    it("replays events since snapshot", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1.0, boredom: 0.0, frustration: 0.0 },
        },
        lastEventId: "event-1",
        createdAt: new Date(1000),
      };

      const eventRecord = {
        id: "event-2",
        streamId: "stream-1",
        type: "input",
        payload: {
          v: 1,
          id: "event-2",
          type: "input",
          createdAt: new Date(2000).toISOString(),
          resource: "user",
          data: {
            _: "input",
            content: "test",
            source: "user",
            ts: 2000,
          },
        },
        createdAt: new Date(2000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([eventRecord]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      // Real applyTransition converts idle + input event -> thinking state
      expect(result.state).toBe("thinking");
      expect(result.physiology.energy).toBeGreaterThanOrEqual(0);
      expect(result.physiology.energy).toBeLessThanOrEqual(1);
    });

    it("starts from idle when no snapshot exists", async () => {
      mockGetLatestSnapshot.mockResolvedValue(undefined);
      mockGetAllEvents.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      // Real idle() creates initial idle state
      expect(result.state).toBe("idle");
      expect(result.physiology.energy).toBeGreaterThanOrEqual(0);
      expect(result.physiology.energy).toBeLessThanOrEqual(1);
    });

    it("filters by metric when specified", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 0.8, boredom: 0.2, frustration: 0.1 },
          autonomy: {
            level: 0.5,
            confidence: 0.7,
            prior: { alpha: 1, beta: 1 },
            evidence: [],
            constraints: [],
            lastUpdate: 1000,
          },
        },
        lastEventId: "event-1",
        createdAt: new Date(1000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        metric: "energy",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      expect(result.physiology.energy).toBe(0.8);
      expect(result.physiology.boredom).toBe(0);
      expect(result.physiology.frustration).toBe(0);
      expect(result.autonomy.level).toBe(0);
    });

    it("filters by autonomy metric", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 0.8, boredom: 0.2, frustration: 0.1 },
          autonomy: {
            level: 0.6,
            confidence: 0.8,
            prior: { alpha: 2, beta: 1 },
            evidence: [],
            constraints: [],
            lastUpdate: 1000,
          },
        },
        lastEventId: "event-1",
        createdAt: new Date(1000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        metric: "autonomy",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      expect(result.autonomy.level).toBe(0.6);
      expect(result.physiology.energy).toBe(0);
      expect(result.physiology.boredom).toBe(0);
      expect(result.physiology.frustration).toBe(0);
    });

    it("enforces cognitive.read policy", async () => {
      authTokenMocks.requireToolScopesAndPolicy.mockRejectedValue(
        new Error("unauthorized")
      );

      const input: CognitiveStateInput = {
        streamId: "stream-1",
      };

      await expect(toolCognitiveState.execute({ input })).rejects.toThrow(
        "unauthorized"
      );
    });

    it("handles errors gracefully", async () => {
      mockGetLatestSnapshot.mockRejectedValue(new Error("db_error"));

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      await expect(toolCognitiveState.execute({ input })).rejects.toThrow(
        "cognitive_state_query_failed"
      );
    });

    it("handles malformed event payloads gracefully", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1.0, boredom: 0.0, frustration: 0.0 },
        },
        lastEventId: "event-1",
        createdAt: new Date(1000),
      };

      // Event with invalid payload structure
      const eventRecord = {
        id: "event-2",
        streamId: "stream-1",
        type: "input",
        payload: {
          v: 1,
          id: "event-2",
          type: "input",
          createdAt: new Date(2000).toISOString(),
          resource: "user",
          data: null, // Invalid: should be event object
        },
        createdAt: new Date(2000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([eventRecord]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      // Should skip invalid events and return snapshot state
      const result = await toolCognitiveState.execute({ input });
      expect(result.state).toBe("idle");
    });

    it("replays multiple events in sequence", async () => {
      const snapshot = {
        streamId: "stream-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1.0, boredom: 0.0, frustration: 0.0 },
        },
        lastEventId: "event-1",
        createdAt: new Date(1000),
      };

      const event1 = {
        id: "event-2",
        streamId: "stream-1",
        type: "input",
        payload: {
          v: 1,
          id: "event-2",
          type: "input",
          createdAt: new Date(2000).toISOString(),
          resource: "user",
          data: {
            _: "input",
            content: "first",
            source: "user",
            ts: 2000,
          },
        },
        createdAt: new Date(2000),
      };

      const event2 = {
        id: "event-3",
        streamId: "stream-1",
        type: "input",
        payload: {
          v: 1,
          id: "event-3",
          type: "input",
          createdAt: new Date(3000).toISOString(),
          resource: "user",
          data: {
            _: "input",
            content: "second",
            source: "user",
            ts: 3000,
          },
        },
        createdAt: new Date(3000),
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([event1, event2]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      // Should process both events and end in thinking state
      expect(result.state).toBe("thinking");
    });
  });

  describe("Schema Validation", () => {
    it("requires streamId", () => {
      const invalid = {};
      const result = toolCognitiveState.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("requires non-empty streamId", () => {
      const invalid = { streamId: "" };
      const result = toolCognitiveState.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts valid metric enum values", () => {
      const validMetrics = [
        "energy",
        "boredom",
        "frustration",
        "autonomy",
        "all",
      ];
      for (const metric of validMetrics) {
        const result = toolCognitiveState.inputSchema.safeParse({
          streamId: "stream-1",
          metric,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid metric values", () => {
      const invalid = { streamId: "stream-1", metric: "invalid" };
      const result = toolCognitiveState.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts optional authz token", () => {
      const result = toolCognitiveState.inputSchema.safeParse({
        streamId: "stream-1",
        authz: "Bearer token",
      });
      expect(result.success).toBe(true);
    });

    it("validates output schema structure", async () => {
      mockGetLatestSnapshot.mockResolvedValue(undefined);
      mockGetAllEvents.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        streamId: "stream-1",
        authz: "Bearer test-token",
      };

      const result = await toolCognitiveState.execute({ input });

      // Validate output matches schema
      const outputValidation =
        toolCognitiveState.outputSchema.safeParse(result);
      expect(outputValidation.success).toBe(true);
      if (outputValidation.success) {
        expect(outputValidation.data.state).toBe("idle");
        expect(outputValidation.data.physiology.energy).toBeGreaterThanOrEqual(
          0
        );
        expect(outputValidation.data.physiology.energy).toBeLessThanOrEqual(1);
        expect(outputValidation.data.autonomy.level).toBeGreaterThanOrEqual(0);
        expect(outputValidation.data.autonomy.level).toBeLessThanOrEqual(1);
        expect(typeof outputValidation.data.since).toBe("number");
      }
    });
  });
});

afterAll(() => {
  mock.restore();
});
