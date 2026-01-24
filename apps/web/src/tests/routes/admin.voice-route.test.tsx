import "../../test/reset-mocks";
import type { inferRouterOutputs } from "@trpc/server";

import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "bun:test";

import type { TRPCAppRouter } from "@/utils/trpc";

import { VoiceAdminView } from "@/routes/_protected/admin/voice";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type VoiceStats = RouterOutputs["admin"]["getVoiceStats"];

function buildStats(): VoiceStats {
  const baseHealth = {
    isHealthy: true,
    lastPing: Date.now(),
    requestCount: 42,
    errorCount: 0,
    uptime: 60_000,
  };

  return {
    generatedAt: Date.now(),
    activeSessions: 3,
    sttPool: {
      size: 2,
      active: 1,
      utilization: 0.5,
      health: [baseHealth],
    },
    ttsPool: {
      size: 1,
      active: 1,
      utilization: 1,
      health: [{ ...baseHealth, isHealthy: false, errorCount: 1 }],
    },
    telemetry: {
      sttLatency: {
        unit: "seconds",
        average: 0.4,
        p50: 0.35,
        p95: 0.8,
        count: 12,
      },
      ttsLatency: {
        unit: "seconds",
        average: 0.6,
        p50: 0.5,
        p95: 0.9,
        count: 8,
      },
      roundTrip: {
        unit: "milliseconds",
        average: 120,
        p50: 100,
        p95: 200,
        count: 30,
      },
      jitter: {
        unit: "milliseconds",
        average: 15,
        p50: 12,
        p95: 30,
        count: 30,
      },
      packetLossTotal: 3,
    },
  } as VoiceStats;
}

describe("VoiceAdminView", () => {
  it("renders stats overview and process health", async () => {
    const handlers: TestTrpcHandlers = {
      queries: {
        "admin.getVoiceStats": () => buildStats(),
      },
    };

    const view = renderRoute(<VoiceAdminView />, {
      queryClient: createTestQueryClient(),
      trpcClient: createTestTrpcClient(handlers),
    });

    await view.findByText("Voice Operations Console");
    expect(view.getAllByTestId("voice-admin-stat").length).toBeGreaterThan(0);
    expect(view.getAllByText(/Process #1/).length).toBeGreaterThan(0);
    await view.findByText("STT Latency");
    view.unmount();
  });

  it("shows biometric gate when elevated auth is required", async () => {
    const handlers: TestTrpcHandlers = {
      queries: {
        "admin.getVoiceStats": () =>
          Promise.reject(
            new TRPCClientError<TRPCAppRouter>("biometric_required", {
              result: {
                error: {
                  message: "biometric_required",
                  code: "FORBIDDEN",
                  data: {
                    code: "FORBIDDEN",
                    httpStatus: 403,
                  },
                },
              } as any,
            })
          ),
      },
    };

    const view = renderRoute(<VoiceAdminView />, {
      queryClient: createTestQueryClient(),
      trpcClient: createTestTrpcClient(handlers),
    });

    await view.findByText("Biometric verification required");
    view.unmount();
  });
});
