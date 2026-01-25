import { describe, expect, mock, test } from "bun:test";

// Mock renderer module
mock.module("../../src/tui/renderer", () => ({
  setupTerminal: mock(() => {}),
  cleanupTerminal: mock(() => {}),
  clearScreen: mock(() => {}),
  writeAt: mock(() => {}),
  getCurrentSize: mock(() => ({ width: 120, height: 40 })),
}));

// Mock keys module
mock.module("../../src/tui/input/keys", () => ({
  getKeyInput: mock(() => ({
    onKey: mock(() => () => {}),
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  isEscape: (e: { key: string }) => e.key === "escape",
  isQuit: (e: { key: string }) => e.key === "q",
}));

// Mock API client
const mockCognitiveState = {
  phase: "idle",
  autonomy: { level: 0.75 },
  ts: Date.now(),
};

const mockAdminStats = {
  workflows: { active: 2, pending: 1, completed: 10 },
  voice: { activeSessions: 0 },
};

mock.module("../../src/tui/api/client", () => ({
  getApiClient: mock(() => ({
    getCognitiveState: mock(async () => ({ data: mockCognitiveState })),
    getAdminStats: mock(async () => ({ data: mockAdminStats })),
  })),
}));

describe("Debug Mode", () => {
  describe("Panel Navigation", () => {
    test("cycles through panels", () => {
      const panels = ["cognitive", "metrics", "active", "logs"];
      let currentIndex = 0;

      // Simulate Tab key
      currentIndex = (currentIndex + 1) % panels.length;
      expect(panels[currentIndex]).toBe("metrics");

      currentIndex = (currentIndex + 1) % panels.length;
      expect(panels[currentIndex]).toBe("active");

      currentIndex = (currentIndex + 1) % panels.length;
      expect(panels[currentIndex]).toBe("logs");

      currentIndex = (currentIndex + 1) % panels.length;
      expect(panels[currentIndex]).toBe("cognitive");
    });

    test("navigates backwards", () => {
      const panels = ["cognitive", "metrics", "active", "logs"];
      let currentIndex = 0;

      // Simulate Shift+Tab
      currentIndex = (currentIndex - 1 + panels.length) % panels.length;
      expect(panels[currentIndex]).toBe("logs");
    });
  });

  describe("Data Formatting", () => {
    test("formats time ago correctly", () => {
      const now = Date.now();

      expect(formatTimeAgo(now - 30_000)).toBe("30s ago");
      expect(formatTimeAgo(now - 120_000)).toBe("2m ago");
      expect(formatTimeAgo(now - 7_200_000)).toBe("2h ago");
    });

    test("gets phase color", () => {
      expect(getPhaseColor("idle")).toBe("#5A6B7D");
      expect(getPhaseColor("executing")).toBe("#00FF88");
      expect(getPhaseColor("thinking")).toBe("#FFB800");
    });

    test("gets autonomy color", () => {
      expect(getAutonomyColor(0.8)).toBe("#00FF88"); // success
      expect(getAutonomyColor(0.6)).toBe("#00D9FF"); // primary
      expect(getAutonomyColor(0.4)).toBe("#FFB800"); // warning
      expect(getAutonomyColor(0.2)).toBe("#FF3366"); // error
    });
  });

  describe("Log Entries", () => {
    test("categorizes log levels", () => {
      const logs: {
        level: "info" | "warn" | "error" | "debug";
        message: string;
      }[] = [
        { level: "info", message: "System started" },
        { level: "warn", message: "Rate limit approaching" },
        { level: "error", message: "Connection failed" },
        { level: "debug", message: "Processing request" },
      ];

      expect(logs.filter((l) => l.level === "error").length).toBe(1);
      expect(logs.filter((l) => l.level === "warn").length).toBe(1);
    });

    test("truncates long messages", () => {
      const message = "A".repeat(100);
      const width = 50;
      const truncated =
        message.length > width - 10
          ? `${message.slice(0, width - 13)}...`
          : message;

      expect(truncated.length).toBeLessThanOrEqual(width);
      expect(truncated.endsWith("...")).toBe(true);
    });
  });

  describe("Metrics", () => {
    test("generates mock metrics with history", () => {
      const history: number[] = [];

      for (let i = 0; i < 20; i++) {
        const newLatency = 30 + Math.random() * 40;
        history.push(newLatency);
      }

      expect(history.length).toBe(20);
      expect(history.every((v) => v >= 30 && v <= 70)).toBe(true);
    });

    test("calculates sparkline values", () => {
      const values = [10, 20, 30, 40, 50];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      const normalized = values.map((v) => (v - min) / range);

      expect(normalized[0]).toBe(0);
      expect(normalized[4]).toBe(1);
    });
  });
});

// ─── Test Helpers ────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    idle: "#5A6B7D",
    capturing: "#00D9FF",
    thinking: "#FFB800",
    deciding: "#00D9FF",
    executing: "#00FF88",
    reflecting: "#8899AA",
  };
  return colors[phase] ?? "#E6E8EB";
}

function getAutonomyColor(level: number): string {
  if (level >= 0.7) {
    return "#00FF88";
  }
  if (level >= 0.5) {
    return "#00D9FF";
  }
  if (level >= 0.3) {
    return "#FFB800";
  }
  return "#FF3366";
}
