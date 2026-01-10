import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { TestSession } from "@alfred/test-kit/auth";
import { RuntimeContext } from "@alfred/type/runtime-context";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const requireRecentBiometricMock = vi.fn();
const getVoicePoolsMock = vi.fn();
const telemetrySnapshot = {
  sttLatency: { average: 0.4, p50: 0.3, p95: 0.8, count: 2, unit: "seconds" },
  ttsLatency: { average: 0.5, p50: 0.4, p95: 0.9, count: 2, unit: "seconds" },
  roundTrip: {
    average: 120,
    p50: 100,
    p95: 200,
    count: 4,
    unit: "milliseconds",
  },
  jitter: { average: 10, p50: 8, p95: 20, count: 4, unit: "milliseconds" },
  packetLossTotal: 0,
};
const collectVoiceTelemetryMock = vi.fn().mockResolvedValue(telemetrySnapshot);
const collectPerformanceTelemetryMock = vi.fn().mockResolvedValue({
  generatedAt: Date.now(),
  graph: {
    queriesTotal: 10,
    queryLatency: {
      average: 0.1,
      p50: 0.05,
      p95: 0.2,
      count: 10,
      unit: "seconds",
    },
    contextLatency: {
      average: 0.2,
      p50: 0.1,
      p95: 0.4,
      count: 5,
      unit: "seconds",
    },
    ragHits: 8,
    ragEmpty: 2,
  },
  assistant: {
    requestsTotal: 5,
    generateLatency: {
      average: 1.5,
      p50: 1.2,
      p95: 2.5,
      count: 5,
      unit: "seconds",
    },
  },
  tools: {
    droidRunsTotal: 3,
    droidDuration: {
      average: 2.0,
      p50: 1.8,
      p95: 3.5,
      count: 3,
      unit: "seconds",
    },
  },
  system: {
    healthChecksTotal: 100,
    cognitiveFeedbackTotal: 12,
  },
});

mock.module("@alfred/auth/biometric", () => ({
  requireRecentBiometric: requireRecentBiometricMock,
  setBiometricTicket: vi.fn(),
  autoGrantBiometricIfBypassed: vi.fn(),
}));

mock.module("../src/voice/pools", () => ({
  getVoicePools: getVoicePoolsMock,
  initializeVoicePools: async () => {},
  shutdownVoicePools: async () => {},
}));

mock.module("../src/voice/telemetry", () => ({
  collectVoiceTelemetry: collectVoiceTelemetryMock,
}));

mock.module("../src/performance/telemetry", () => ({
  collectPerformanceTelemetry: collectPerformanceTelemetryMock,
}));

const createPoolMocks = () => {
  const stats = {
    generatedAt: Date.now(),
    activeSessions: 2,
    sttPool: { size: 1, active: 0 },
    ttsPool: { size: 1, active: 0 },
    message: "ok",
  };
  return {
    stats,
    voiceRegistry: {
      getStats: vi.fn().mockReturnValue(stats),
      clearSessions: vi.fn().mockReturnValue(5),
    },
    sttPool: {
      shutdown: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
    },
    ttsPool: {
      shutdown: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
    },
  };
};

type PartialSession = {
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
} | null;

async function createCallerWithCustomSession(
  session: TestSession | PartialSession
) {
  const { appRouter } = await import("@alfred/api/routers/index");
  const runtime = {
    requestId: "custom-session",
    receivedAt: new Date(),
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["scanContext", null],
  ]);
  return appRouter.createCaller({
    session,
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof appRouter.createCaller>[0]);
}

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let pools: ReturnType<typeof createPoolMocks>;

beforeAll(async () => {
  caller = await createTestCaller();
});

beforeEach(() => {
  pools = createPoolMocks();
  getVoicePoolsMock.mockImplementation(() => pools);
  requireRecentBiometricMock.mockResolvedValue(undefined);
});

afterEach(() => {
  resetAllMocks();
});

describe("admin router", () => {
  describe("getVoiceStats", () => {
    it("requires recent biometric before returning stats", async () => {
      const result = await caller.admin.getVoiceStats();

      expect(requireRecentBiometricMock).toHaveBeenCalledTimes(1);
      expect(getVoicePoolsMock).toHaveBeenCalledTimes(1);
      expect(pools.voiceRegistry.getStats).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ...pools.stats,
        telemetry: telemetrySnapshot,
      });
      expect(collectVoiceTelemetryMock).toHaveBeenCalledTimes(1);
    });

    it("throws FORBIDDEN when biometric ticket is stale", async () => {
      requireRecentBiometricMock.mockRejectedValue(
        new Error("biometric_required")
      );

      await expect(caller.admin.getVoiceStats()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "biometric_required",
      });
      expect(getVoicePoolsMock).not.toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED when session id is missing", async () => {
      const callerWithoutSession = await createCallerWithCustomSession({
        user: {
          id: "test-user",
          roles: ["owner"],
          scopes: ["admin"],
          email: "test-user@test.local",
          name: "Test User",
        },
      });

      await expect(
        callerWithoutSession.admin.getVoiceStats()
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(requireRecentBiometricMock).not.toHaveBeenCalled();
      expect(getVoicePoolsMock).not.toHaveBeenCalled();
    });
  });

  describe("getPerformanceStats", () => {
    it("returns performance telemetry after biometric check", async () => {
      const result = await caller.admin.getPerformanceStats();

      expect(requireRecentBiometricMock).toHaveBeenCalledTimes(1);
      expect(collectPerformanceTelemetryMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("graph");
      expect(result.graph.queriesTotal).toBe(10);
    });

    it("requires biometric validation", async () => {
      requireRecentBiometricMock.mockRejectedValue(new Error("forbidden"));

      await expect(caller.admin.getPerformanceStats()).rejects.toThrow();
    });
  });

  describe("restartVoicePool", () => {
    it("restarts the requested pool when biometric passes", async () => {
      const result = await caller.admin.restartVoicePool({ pool: "stt" });

      expect(requireRecentBiometricMock).toHaveBeenCalledTimes(1);
      expect(pools.sttPool.shutdown).toHaveBeenCalledTimes(1);
      expect(pools.sttPool.initialize).toHaveBeenCalledTimes(1);
      expect(pools.ttsPool.shutdown).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, pool: "stt" });
    });

    it("propagates biometric failures", async () => {
      requireRecentBiometricMock.mockRejectedValue(new Error("expired"));

      await expect(
        caller.admin.restartVoicePool({ pool: "tts" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "expired",
      });
      expect(pools.ttsPool.shutdown).not.toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED when session id is missing", async () => {
      const callerWithoutSession = await createCallerWithCustomSession({
        user: {
          id: "test-user",
          roles: ["owner"],
          scopes: ["admin"],
          email: "test-user@test.local",
          name: "Test User",
        },
      });

      await expect(
        callerWithoutSession.admin.restartVoicePool({ pool: "tts" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(requireRecentBiometricMock).not.toHaveBeenCalled();
      expect(pools.ttsPool.shutdown).not.toHaveBeenCalled();
    });
  });

  describe("clearVoiceSessions", () => {
    it("clears sessions after biometric validation", async () => {
      const result = await caller.admin.clearVoiceSessions();

      expect(requireRecentBiometricMock).toHaveBeenCalledTimes(1);
      expect(pools.voiceRegistry.clearSessions).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ cleared: 5 });
    });

    it("propagates biometric failure", async () => {
      requireRecentBiometricMock.mockRejectedValue(new Error("expired"));

      await expect(caller.admin.clearVoiceSessions()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "expired",
      });
      expect(pools.voiceRegistry.clearSessions).not.toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED when session id is missing", async () => {
      const callerWithoutSession = await createCallerWithCustomSession({
        user: {
          id: "test-user",
          roles: ["owner"],
          scopes: ["admin"],
          email: "test-user@test.local",
          name: "Test User",
        },
      });

      await expect(
        callerWithoutSession.admin.clearVoiceSessions()
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(requireRecentBiometricMock).not.toHaveBeenCalled();
      expect(pools.voiceRegistry.clearSessions).not.toHaveBeenCalled();
    });
  });
});
