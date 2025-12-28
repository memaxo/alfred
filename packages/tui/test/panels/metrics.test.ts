import { describe, expect, test } from "bun:test";
import { renderLatency } from "../../src/tui/panels/metrics/latency";
import { sparkline } from "../../src/tui/panels/metrics/sparklines";
import { renderThroughputChart } from "../../src/tui/panels/metrics/throughput";

describe("Metrics Panel Components", () => {
  describe("Sparkline Rendering", () => {
    test("renders sparkline from data", () => {
      const data = [10, 20, 30, 40, 50];
      const result = sparkline(data, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBe(10);
    });

    test("handles empty data", () => {
      const result = sparkline([], 10);
      expect(result).toBeDefined();
      expect(result.length).toBe(10);
    });

    test("handles single value", () => {
      const result = sparkline([42], 10);
      expect(result).toBeDefined();
      expect(result.length).toBe(10);
    });

    test("handles negative values", () => {
      const data = [-10, 0, 10];
      const result = sparkline(data, 10);
      expect(result).toBeDefined();
    });

    test("respects width constraint", () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      const widths = [5, 10, 20, 40];

      for (const width of widths) {
        const result = sparkline(data, width);
        expect(result.length).toBe(width);
      }
    });
  });

  describe("Latency Rendering", () => {
    test("renders latency breakdown", () => {
      const latencyData = [
        { router: "assistant", p50: 45, p95: 120, p99: 250 },
        { router: "workflow", p50: 32, p95: 89, p99: 156 },
      ];

      const result = renderLatency(latencyData, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles empty latency data", () => {
      const result = renderLatency([], 60);
      expect(result).toBeDefined();
    });

    test("handles single router", () => {
      const latencyData = [
        { router: "assistant", p50: 45, p95: 120, p99: 250 },
      ];

      const result = renderLatency(latencyData, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Throughput Rendering", () => {
    test("renders throughput chart", () => {
      const data = [100, 150, 120, 180, 200];
      const result = renderThroughputChart(data, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles zero throughput", () => {
      const data = [0, 0, 0, 0];
      const result = renderThroughputChart(data, 60);
      expect(result).toBeDefined();
    });

    test("handles high throughput values", () => {
      const data = [1000, 5000, 10_000, 15_000];
      const result = renderThroughputChart(data, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Mock Data", () => {
    test("creates valid mock metrics state", () => {
      const state = {
        latency: [
          { router: "assistant", p50: 45, p95: 120, p99: 250 },
          { router: "workflow", p50: 32, p95: 89, p99: 156 },
        ],
        throughput: [100, 150, 120, 180, 200],
      };

      expect(state.latency).toBeDefined();
      expect(state.throughput).toBeDefined();
    });

    test("mock state has reasonable values", () => {
      const state = {
        latency: [
          { router: "assistant", p50: 45, p95: 120, p99: 250 },
          { router: "workflow", p50: 32, p95: 89, p99: 156 },
        ],
        throughput: [100, 150, 120, 180, 200],
      };

      // Latency should be > 0
      for (const router of state.latency) {
        expect(router.p50).toBeGreaterThanOrEqual(0);
        expect(router.p95).toBeGreaterThanOrEqual(router.p50);
        expect(router.p99).toBeGreaterThanOrEqual(router.p95);
      }

      // Throughput should be >= 0
      for (const value of state.throughput) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
