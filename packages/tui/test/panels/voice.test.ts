import { describe, expect, test } from "bun:test";
import { renderVoiceLatency } from "../../src/tui/panels/voice/latency";
import { renderPoolStatus } from "../../src/tui/panels/voice/pools";
import { renderSessions } from "../../src/tui/panels/voice/sessions";

describe("Voice Panel Components", () => {
  describe("Pool Status Rendering", () => {
    test("renders pool status", () => {
      const pool = {
        name: "stt",
        workers: 2,
        maxWorkers: 3,
        processing: 1,
        queueDepth: 0,
      };

      const result = renderPoolStatus(pool, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles idle pool", () => {
      const pool = {
        name: "tts",
        workers: 0,
        maxWorkers: 3,
        processing: 0,
        queueDepth: 0,
      };

      const result = renderPoolStatus(pool, 60);
      expect(result).toBeDefined();
    });

    test("handles busy pool", () => {
      const pool = {
        name: "stt",
        workers: 3,
        maxWorkers: 3,
        processing: 3,
        queueDepth: 8,
      };

      const result = renderPoolStatus(pool, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Session Rendering", () => {
    test("renders active sessions", () => {
      const sessions = [
        { id: "session-1", status: "active" as const, duration: 120 },
        { id: "session-2", status: "active" as const, duration: 45 },
      ];

      const result = renderSessions(sessions, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles empty sessions", () => {
      const result = renderSessions([], 60);
      expect(result).toBeDefined();
    });

    test("handles various session statuses", () => {
      const sessions = [
        { id: "session-1", status: "active" as const, duration: 120 },
        { id: "session-2", status: "paused" as const, duration: 45 },
        { id: "session-3", status: "ended" as const, duration: 300 },
      ];

      const result = renderSessions(sessions, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Latency Rendering", () => {
    test("renders voice latency stats", () => {
      const latency = {
        stt: { p50: 120, p99: 280 },
        tts: { p50: 85, p99: 190 },
      };

      const result = renderVoiceLatency(latency, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles zero latency", () => {
      const latency = {
        stt: { p50: 0, p99: 0 },
        tts: { p50: 0, p99: 0 },
      };

      const result = renderVoiceLatency(latency, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Mock Data", () => {
    test("creates valid mock voice state", () => {
      const state = {
        pools: {
          stt: {
            name: "stt",
            workers: 2,
            maxWorkers: 3,
            processing: 1,
            queueDepth: 0,
          },
          tts: {
            name: "tts",
            workers: 1,
            maxWorkers: 3,
            processing: 0,
            queueDepth: 0,
          },
        },
        sessions: [
          { id: "session-1", status: "active" as const, duration: 120 },
        ],
        latency: {
          stt: { p50: 120, p99: 280 },
          tts: { p50: 85, p99: 190 },
        },
      };

      expect(state.pools.stt).toBeDefined();
      expect(state.pools.tts).toBeDefined();
      expect(Array.isArray(state.sessions)).toBe(true);
    });

    test("mock pool numbers are valid", () => {
      const pool = {
        name: "stt",
        workers: 2,
        maxWorkers: 3,
        processing: 1,
        queueDepth: 0,
      };

      expect(pool.workers).toBeLessThanOrEqual(pool.maxWorkers);
      expect(pool.processing).toBeLessThanOrEqual(pool.workers);
    });
  });
});
