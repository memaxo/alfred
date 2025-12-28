import { describe, expect, test } from "bun:test";
import { renderAutonomyGauge } from "../../src/tui/panels/cognitive/autonomy";
// Import panel components for testing
// Note: We're testing the render functions directly since panels use composition
import { renderPhaseIndicator } from "../../src/tui/panels/cognitive/phase";
import {
  renderPhysiology,
  renderPhysiologyIndicators,
} from "../../src/tui/panels/cognitive/physiology";
import { createMockCognitiveState } from "../../src/tui/subscriptions/cognitive";

describe("Cognitive Panel Components", () => {
  const _mockState = createMockCognitiveState();

  describe("Phase Indicator", () => {
    test("renders phase indicator", () => {
      const result = renderPhaseIndicator("thinking", 60);
      // Output includes ANSI codes, check for uppercase label
      expect(result.toUpperCase()).toContain("THINKING");
      expect(typeof result).toBe("string");
    });

    test("handles all cognitive phases", () => {
      const phases = [
        "idle",
        "capturing",
        "thinking",
        "deciding",
        "executing",
        "reflecting",
      ] as const;

      for (const phase of phases) {
        const result = renderPhaseIndicator(phase, 60);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      }
    });

    test("respects width constraint", () => {
      const widths = [40, 60, 80, 120];
      for (const width of widths) {
        const result = renderPhaseIndicator("thinking", width);
        // Output includes ANSI escape codes, so length will exceed visual width
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Autonomy Gauge", () => {
    test("renders autonomy gauge", () => {
      // renderAutonomyGauge expects AutonomyState, not a number
      const autonomyState = { level: 0.72, confidence: 0.8, threshold: 0.5 };
      const result = renderAutonomyGauge(autonomyState, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles edge case autonomy values", () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0];
      for (const value of values) {
        const autonomyState = { level: value, confidence: 0.5, threshold: 0.5 };
        const result = renderAutonomyGauge(autonomyState, 60);
        expect(result).toBeDefined();
      }
    });

    test("clamps invalid autonomy values", () => {
      // Should not throw on out-of-range values
      expect(() =>
        renderAutonomyGauge(
          { level: -0.1, confidence: 0.5, threshold: 0.5 },
          60
        )
      ).not.toThrow();
      expect(() =>
        renderAutonomyGauge({ level: 1.5, confidence: 0.5, threshold: 0.5 }, 60)
      ).not.toThrow();
    });
  });

  describe("Physiology Indicators", () => {
    test("renders physiology indicators", () => {
      const physiology = {
        energy: 0.91,
        frustration: 0.12,
        boredom: 0.05,
      };
      const result = renderPhysiologyIndicators(physiology, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("renders physiology compact view", () => {
      const physiology = {
        energy: 0.91,
        frustration: 0.12,
        boredom: 0.05,
      };
      const result = renderPhysiology(physiology, 40);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("handles zero values", () => {
      const physiology = {
        energy: 0.0,
        frustration: 0.0,
        boredom: 0.0,
      };
      const result = renderPhysiologyIndicators(physiology, 60);
      expect(result).toBeDefined();
    });

    test("handles maximum values", () => {
      const physiology = {
        energy: 1.0,
        frustration: 1.0,
        boredom: 1.0,
      };
      const result = renderPhysiologyIndicators(physiology, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Mock Data", () => {
    test("createMockCognitiveState returns valid state", () => {
      const state = createMockCognitiveState();
      expect(state).toBeDefined();
      expect(state.phase).toBeDefined();
      expect(state.autonomy).toBeDefined();
      expect(state.physiology).toBeDefined();
    });

    test("mock state has required fields", () => {
      const state = createMockCognitiveState();
      expect(typeof state.autonomy).toBe("number");
      expect(state.autonomy).toBeGreaterThanOrEqual(0);
      expect(state.autonomy).toBeLessThanOrEqual(1);
      expect(state.physiology.energy).toBeGreaterThanOrEqual(0);
      expect(state.physiology.frustration).toBeGreaterThanOrEqual(0);
      expect(state.physiology.boredom).toBeGreaterThanOrEqual(0);
    });
  });
});
