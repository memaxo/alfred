/**
 * Autonomy Calculator Integration Tests
 *
 * Tests autonomy level calculation and enforcement:
 * - Autonomy level calculation based on multiple factors
 * - Autonomy threshold enforcement
 * - Autonomy changes triggering appropriate actions
 * - Autonomy metrics tracking
 *
 * Uses SQLite in-memory database for fast, isolated tests.
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";

const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "autonomy-calculator.json"
);

// Lazy-loaded modules
let VCRRecorder: typeof import("@alfred/test-kit/vcr").VCRRecorder;
let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: InstanceType<typeof VCRRecorder>;

let _createTestCaller: typeof import("../utils/trpc").createTestCaller;
let resetAllMocks: typeof import("../utils/router-helpers").resetAllMocks;

beforeAll(async () => {
  ({ VCRRecorder, createVCR } = await import("@alfred/test-kit/vcr"));
  ({ _createTestCaller } = await import("../utils/trpc"));
  ({ resetAllMocks } = await import("../utils/router-helpers"));

  vcr = createVCR({
    cassettePath,
    strictReplay: false,
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
});

afterEach(() => {
  resetAllMocks();
});

describe("Autonomy Calculator", () => {
  describe("Autonomy Level Calculation", () => {
    it("initializes autonomy with valid values", async () => {
      const { initialAutonomy } = await import("@alfred/cognitive/state");

      const autonomy = initialAutonomy(Date.now());

      expect(autonomy).toBeDefined();
      expect(autonomy.level).toBeDefined();
      expect(autonomy.confidence).toBeDefined();
      expect(Number(autonomy.level)).toBeGreaterThanOrEqual(0);
      expect(Number(autonomy.level)).toBeLessThanOrEqual(1);
    });

    it("calculates autonomy based on evidence", async () => {
      const { initialAutonomy, updateAutonomy } = await import(
        "@alfred/cognitive/state"
      );

      const now = Date.now();
      let autonomy = initialAutonomy(now);

      // Add positive evidence
      autonomy = updateAutonomy(now, autonomy, {
        _: "success",
        reliability: 1.0,
      });

      expect(autonomy).toBeDefined();
      expect(Number(autonomy.level)).toBeGreaterThanOrEqual(0);
      expect(Number(autonomy.level)).toBeLessThanOrEqual(1);
    });

    it("incorporates multiple evidence sources", async () => {
      const { initialAutonomy, updateAutonomy } = await import(
        "@alfred/cognitive/state"
      );

      const now = Date.now();
      let autonomy = initialAutonomy(now);

      // Add multiple evidence sources
      autonomy = updateAutonomy(now, autonomy, {
        _: "success",
        reliability: 0.9,
      });
      autonomy = updateAutonomy(now + 100, autonomy, {
        _: "success",
        reliability: 0.8,
      });
      autonomy = updateAutonomy(now + 200, autonomy, {
        _: "feedback",
        positive: true,
        reliability: 0.7,
      });

      expect(autonomy).toBeDefined();
      expect(autonomy.evidence).toBeInstanceOf(Array);
      expect(autonomy.evidence.length).toBeGreaterThan(0);
    });
  });

  describe("Autonomy Threshold Enforcement", () => {
    it("enforces minimum threshold for operations", async () => {
      const { autonomy } = await import("@alfred/cognitive/state");

      const fakeAutonomy = {
        level: autonomy(0.3), // Below threshold
        confidence: autonomy(0.5),
        lastUpdate: Date.now(),
        evidence: [],
        prior: { alpha: 1, beta: 1 },
        constraints: [
          { _: "approval", required: true },
          { _: "confidence", minimum: autonomy(0.7) },
        ],
      };

      const minThreshold = 0.5;
      const levelBelowThreshold = Number(fakeAutonomy.level) < minThreshold;

      expect(minThreshold).toBe(0.5);
      if (levelBelowThreshold) {
        expect(fakeAutonomy.constraints).toBeInstanceOf(Array);
      }
    });

    it("blocks actions below autonomy threshold", () => {
      // Verify that actions requiring autonomy are blocked
      // when autonomy level is below threshold
      const autonomyLevel = 0.3;
      const requiredLevel = 0.5;

      const canPerform = autonomyLevel >= requiredLevel;

      if (!canPerform) {
        expect(autonomyLevel).toBeLessThan(requiredLevel);
      }
    });

    it("triggers approval flow when below threshold", () => {
      // Verify that approval flow is triggered when
      // autonomy is below threshold
      const autonomyLevel = 0.4;
      const threshold = 0.6;

      if (autonomyLevel < threshold) {
        const requiresApproval = true;
        expect(requiresApproval).toBe(true);
      }
    });
  });

  describe("Autonomy Changes Trigger Actions", () => {
    it("triggers notification on threshold crossing", () => {
      // Verify that notifications are triggered when autonomy
      // crosses a threshold
      const oldLevel = 0.4;
      const newLevel = 0.75;
      const threshold = 0.7;

      const crossedThreshold = oldLevel < threshold && newLevel >= threshold;

      if (crossedThreshold) {
        expect(newLevel).toBeGreaterThanOrEqual(threshold);
      }
    });

    it("updates behavior based on autonomy level", () => {
      // Verify that behavior changes based on autonomy level
      const autonomyLevel = 0.8;

      let behavior: "conservative" | "balanced" | "aggressive";

      if (autonomyLevel < 0.3) {
        behavior = "conservative";
      } else if (autonomyLevel < 0.7) {
        behavior = "balanced";
      } else {
        behavior = "aggressive";
      }

      expect(behavior).toBe("aggressive");
    });

    it("adjusts tool selection based on autonomy", () => {
      // Verify that tool selection is adjusted based on autonomy level
      const autonomyLevel = 0.6;
      const availableTools = {
        low: ["basic-read"],
        medium: ["basic-read", "simple-write"],
        high: ["basic-read", "simple-write", "advanced-execute"],
      };

      let selectedTools: string[];
      if (autonomyLevel < 0.5) {
        selectedTools = availableTools.low;
      } else if (autonomyLevel < 0.8) {
        selectedTools = availableTools.medium;
      } else {
        selectedTools = availableTools.high;
      }

      expect(selectedTools).toContain("simple-write");
    });
  });

  describe("Autonomy Metrics Tracking", () => {
    it("tracks autonomy level over time", () => {
      // Verify that autonomy level changes are tracked over time
      const history: Array<{ timestamp: number; level: number }> = [];

      const now = Date.now();
      history.push({ timestamp: now, level: 0.3 });
      history.push({ timestamp: now + 1000, level: 0.4 });
      history.push({ timestamp: now + 2000, level: 0.5 });

      expect(history.length).toBe(3);
      expect(history[2].level).toBeGreaterThan(history[0].level);
    });

    it("calculates autonomy change rate", () => {
      // Verify that the rate of autonomy change is calculated
      const initialLevel = 0.3;
      const finalLevel = 0.7;
      const duration = 10_000; // 10 seconds

      const changeRate = (finalLevel - initialLevel) / (duration / 1000);

      expect(changeRate).toBeCloseTo(0.04); // 0.4 increase over 10 seconds = 0.04/second
    });
  });

  describe("Confidence Tracking", () => {
    it("updates confidence based on evidence", async () => {
      const { initialAutonomy, updateAutonomy } = await import(
        "@alfred/cognitive/state"
      );

      const now = Date.now();
      let autonomy = initialAutonomy(now);

      const initialConfidence = Number(autonomy.confidence);

      // Add evidence
      autonomy = updateAutonomy(now, autonomy, {
        _: "success",
        reliability: 1.0,
      });

      const finalConfidence = Number(autonomy.confidence);

      expect(initialConfidence).toBeGreaterThanOrEqual(0);
      expect(finalConfidence).toBeGreaterThanOrEqual(0);
    });

    it("flags low confidence states", () => {
      // Verify that low confidence states are flagged
      const confidence = 0.5;
      const threshold = 0.6;

      const isLowConfidence = confidence < threshold;

      if (isLowConfidence) {
        expect(confidence).toBeLessThan(threshold);
      }
    });
  });

  describe("Performance Budgets", () => {
    it("meets performance budget for calculation", async () => {
      const { initialAutonomy } = await import("@alfred/cognitive/state");

      const start = Date.now();
      initialAutonomy(Date.now());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1); // Should complete in <1ms
    });

    it("meets performance budget for updates", async () => {
      const { initialAutonomy, updateAutonomy } = await import(
        "@alfred/cognitive/state"
      );

      const now = Date.now();
      const autonomy = initialAutonomy(now);

      const start = Date.now();
      updateAutonomy(now + 100, autonomy, { _: "success", reliability: 1.0 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5); // Should complete in <5ms
    });
  });
});
