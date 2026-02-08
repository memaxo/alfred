// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import type { CognitiveStateInput } from "../src/orchestrator/tool/cognitive";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

const mockGetLatestSnapshot = mock();
const mockGetEventsSince = mock();
const mockGetAllEvents = mock();
const dbModule = await import("@alfred/db");
let getLatestSnapshotSpy: ReturnType<typeof vi.spyOn> | null = null;
let getEventsSinceSpy: ReturnType<typeof vi.spyOn> | null = null;
let getAllEventsSpy: ReturnType<typeof vi.spyOn> | null = null;

// Note: Pure functions (idle, initialAutonomy, applyTransition, unwrapEventEnvelope)
// are NOT mocked - we use real implementations to test actual behavior

// Import tool after mocking
const { toolCognitiveState } =
  await import("../src/orchestrator/tool/cognitive");

describe("Cognitive State Tool", () => {
  beforeAll(() => {
    getLatestSnapshotSpy = vi
      .spyOn(dbModule.cognitiveRepo, "getLatestSnapshot")
      .mockImplementation((...args) => mockGetLatestSnapshot(...args));
    getEventsSinceSpy = vi
      .spyOn(dbModule.cognitiveRepo, "getEventsSince")
      .mockImplementation((...args) => mockGetEventsSince(...args));
    getAllEventsSpy = vi
      .spyOn(dbModule.cognitiveRepo, "getAllEvents")
      .mockImplementation((...args) => mockGetAllEvents(...args));
  });

  beforeEach(() => {
    authTokenMocks.requireToolScopesAndPolicy.mockReset();
    mockGetLatestSnapshot.mockReset();
    mockGetEventsSince.mockReset();
    mockGetAllEvents.mockReset();

    // Default to allowing all policy checks
    authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
      claims: {
        sub: "test-user",
        scopes: ["cognitive.read"],
      },
      decision: { allow: true },
    });
  });

  afterAll(() => {
    getLatestSnapshotSpy?.mockRestore();
    getLatestSnapshotSpy = null;
    getEventsSinceSpy?.mockRestore();
    getEventsSinceSpy = null;
    getAllEventsSpy?.mockRestore();
    getAllEventsSpy = null;
  });

  describe("cognitive_state", () => {
    it("returns current state from snapshot without events", async () => {
      const snapshot = {
        createdAt: new Date(2000),
        lastEventId: "event-1",
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
        streamId: "stream-1",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
      };

      const result = await toolCognitiveState.execute({ input });

      expect(result.state).toBe("thinking");
      expect(result.physiology.energy).toBe(0.7);
      expect(result.autonomy.level).toBe(0.6);
      expect(result.since).toBe(2000);
    });

    it("replays events since snapshot", async () => {
      const snapshot = {
        createdAt: new Date(1000),
        lastEventId: "event-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1, boredom: 0, frustration: 0 },
        },
        streamId: "stream-1",
      };

      const eventRecord = {
        createdAt: new Date(2000),
        id: "event-2",
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
        streamId: "stream-1",
        type: "input",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([eventRecord]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
      };

      const result = await toolCognitiveState.execute({ input });

      // Real applyTransition converts idle + input event -> capturing state
      expect(result.state).toBe("capturing");
      expect(result.physiology.energy).toBeGreaterThanOrEqual(0);
      expect(result.physiology.energy).toBeLessThanOrEqual(1);
    });

    it("starts from idle when no snapshot exists", async () => {
      mockGetLatestSnapshot.mockResolvedValue();
      mockGetAllEvents.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
      };

      const result = await toolCognitiveState.execute({ input });

      // Real idle() creates initial idle state
      expect(result.state).toBe("idle");
      expect(result.physiology.energy).toBeGreaterThanOrEqual(0);
      expect(result.physiology.energy).toBeLessThanOrEqual(1);
    });

    it("filters by metric when specified", async () => {
      const snapshot = {
        createdAt: new Date(1000),
        lastEventId: "event-1",
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
        streamId: "stream-1",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        metric: "energy",
        streamId: "stream-1",
      };

      const result = await toolCognitiveState.execute({ input });

      expect(result.physiology.energy).toBe(0.8);
      expect(result.physiology.boredom).toBe(0);
      expect(result.physiology.frustration).toBe(0);
      expect(result.autonomy.level).toBe(0);
    });

    it("filters by autonomy metric", async () => {
      const snapshot = {
        createdAt: new Date(1000),
        lastEventId: "event-1",
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
        streamId: "stream-1",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        metric: "autonomy",
        streamId: "stream-1",
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
        authz: "Bearer test-token",
        streamId: "stream-1",
      };

      await expect(toolCognitiveState.execute({ input })).rejects.toThrow(
        "cognitive_state_query_failed"
      );
    });

    it("handles malformed event payloads gracefully", async () => {
      const snapshot = {
        createdAt: new Date(1000),
        lastEventId: "event-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1, boredom: 0, frustration: 0 },
        },
        streamId: "stream-1",
      };

      // Event with invalid payload structure
      const eventRecord = {
        createdAt: new Date(2000),
        id: "event-2",
        payload: {
          v: 1,
          id: "event-2",
          type: "input",
          createdAt: new Date(2000).toISOString(),
          resource: "user",
          data: null, // Invalid: should be event object
        },
        streamId: "stream-1",
        type: "input",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([eventRecord]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
      };

      // Should skip invalid events and return snapshot state
      const result = await toolCognitiveState.execute({ input });
      expect(result.state).toBe("idle");
    });

    it("replays multiple events in sequence", async () => {
      const snapshot = {
        createdAt: new Date(1000),
        lastEventId: "event-1",
        state: {
          _: "idle",
          since: 1000,
          physiology: { energy: 1, boredom: 0, frustration: 0 },
        },
        streamId: "stream-1",
      };

      const event1 = {
        createdAt: new Date(2000),
        id: "event-2",
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
        streamId: "stream-1",
        type: "input",
      };

      const event2 = {
        createdAt: new Date(3000),
        id: "event-3",
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
        streamId: "stream-1",
        type: "input",
      };

      mockGetLatestSnapshot.mockResolvedValue(snapshot);
      mockGetEventsSince.mockResolvedValue([event1, event2]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
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
          metric,
          streamId: "stream-1",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid metric values", () => {
      const invalid = { metric: "invalid", streamId: "stream-1" };
      const result = toolCognitiveState.inputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts optional authz token", () => {
      const result = toolCognitiveState.inputSchema.safeParse({
        authz: "Bearer token",
        streamId: "stream-1",
      });
      expect(result.success).toBe(true);
    });

    it("validates output schema structure", async () => {
      mockGetLatestSnapshot.mockResolvedValue();
      mockGetAllEvents.mockResolvedValue([]);

      const input: CognitiveStateInput = {
        authz: "Bearer test-token",
        streamId: "stream-1",
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
