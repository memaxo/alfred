import "@/test/dom";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { fireEvent, waitFor } from "@testing-library/react";
import { useDesktopStore } from "@/store/desktop";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
} from "@/test/render-route";
import { AdminApp } from "../index";

const mockPerformanceStats = {
  generatedAt: Date.now(),
  graph: {
    queriesTotal: 100,
    queryLatency: { p50: 0.001 },
    contextLatency: { p50: 0.002 },
    ragHits: 80,
    ragEmpty: 20,
  },
  assistant: { requestsTotal: 50, generateLatency: { p50: 1.5 } },
  tools: { droidRunsTotal: 10, droidDuration: { p50: 3.0 } },
  system: { healthChecksTotal: 1000 },
};

const mockVoiceStats = {
  generatedAt: Date.now(),
  activeSessions: 2,
  sttPool: { active: 1, size: 2, utilization: 0.5, health: [] },
  ttsPool: { active: 1, size: 2, utilization: 0.5, health: [] },
  telemetry: null,
};

const mockSessions = {
  sessions: [
    {
      id: "s1",
      ipAddress: "127.0.0.1",
      userAgent: "Chrome",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
      isCurrent: true,
    },
  ],
};

function setup() {
  const queryClient = createTestQueryClient();
  const trpcClient = createTestTrpcClient({
    queries: {
      "admin.getPerformanceStats": () => mockPerformanceStats,
      "admin.getVoiceStats": () => mockVoiceStats,
      "admin.sessionsList": () => mockSessions,
    },
  });

  return renderRoute(
    <AdminApp
      window={{
        id: "admin-window",
        type: "admin",
        data: { type: "admin", viewMode: "full" },
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        state: "normal",
        isTiled: false,
        zIndex: 1,
        isFocused: true,
        minSize: { width: 500, height: 400 },
        resizable: true,
        createdAt: Date.now(),
        lastFocusedAt: Date.now(),
      }}
    />,
    { queryClient, trpcClient }
  );
}

describe("AdminApp", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      focusedWindowId: null,
    });
  });

  it("renders the performance tab by default", async () => {
    const { getByText, getAllByText } = setup();
    expect(getByText("Admin & Operations")).toBeTruthy();
    await waitFor(() => {
      expect(getByText("Operational Dashboard")).toBeTruthy();
    });
    expect(getAllByText("Graph Queries").length).toBeGreaterThan(0);
  });

  it("switches to voice operations tab", async () => {
    const { getAllByText } = setup();
    const voiceTab = getAllByText("Voice Ops")[0];
    fireEvent.click(voiceTab);

    await waitFor(() => {
      expect(getAllByText("Voice Operations Console").length).toBeGreaterThan(
        0
      );
    });
  });

  it("switches to sessions tab", async () => {
    const { getAllByText } = setup();
    const sessionsTab = getAllByText("Sessions")[0];
    fireEvent.click(sessionsTab);

    await waitFor(() => {
      expect(getAllByText("Active Sessions").length).toBeGreaterThan(0);
    });
    expect(getAllByText("Chrome Browser").length).toBeGreaterThan(0);
  });

  it("spawns external tools when buttons are clicked", () => {
    const spawnWindowSpy = vi.fn();
    useDesktopStore.setState({ spawnWindow: spawnWindowSpy });

    const { getAllByText } = setup();

    fireEvent.click(getAllByText("Policy Viewer")[0]);
    expect(spawnWindowSpy).toHaveBeenCalledWith("policy");

    fireEvent.click(getAllByText("Metrics Explorer")[0]);
    expect(spawnWindowSpy).toHaveBeenCalledWith("metrics");

    fireEvent.click(getAllByText("Task Manager")[0]);
    expect(spawnWindowSpy).toHaveBeenCalledWith("taskmanager");
  });
});
