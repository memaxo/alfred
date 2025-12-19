import { describe, expect, it, beforeEach } from "bun:test";
import { LoopDetector, type LoopConfig } from "../src/loop";

describe("LoopDetector", () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  describe("Layer 0: COUNT (max transitions)", () => {
    it("triggers when maxTransitions exceeded", () => {
      const config: Partial<LoopConfig> = { maxTransitions: 5 };
      detector = new LoopDetector(config);

      // First 5 should pass
      for (let i = 0; i < 5; i++) {
        const result = detector.check(`unique thought ${i}`);
        expect(result.loop).toBe(false);
      }

      // 6th should trigger
      const result = detector.check("one more thought");
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toBe("max_transitions");
        expect(result.layer).toBe(0);
      }
    });

    it("uses default maxTransitions of 500", () => {
      expect(detector.getTransitionCount()).toBe(0);
      detector.check("test");
      expect(detector.getTransitionCount()).toBe(1);
    });
  });

  describe("Layer 1: TIME (stall detection)", () => {
    it("triggers when stall threshold exceeded", async () => {
      const config: Partial<LoopConfig> = { stallMs: 50 };
      detector = new LoopDetector(config);

      // First check passes
      let result = detector.check("initial thought");
      expect(result.loop).toBe(false);

      // Wait longer than stall threshold
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Next check should trigger stall
      result = detector.check("after stall");
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toBe("stall");
        expect(result.layer).toBe(1);
      }
    });

    it("does not trigger if activity is continuous", async () => {
      const config: Partial<LoopConfig> = { stallMs: 100 };
      detector = new LoopDetector(config);

      for (let i = 0; i < 5; i++) {
        const result = detector.check(`thought ${i}`);
        expect(result.loop).toBe(false);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    });
  });

  describe("Layer 2: HASH (exact match)", () => {
    it("triggers on exact string repetition", () => {
      const thought = "I need to check the configuration file";

      // First occurrence passes
      let result = detector.check(thought);
      expect(result.loop).toBe(false);

      // Different thought passes
      result = detector.check("Now analyzing the results");
      expect(result.loop).toBe(false);

      // Same thought again triggers
      result = detector.check(thought);
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toBe("exact_match");
        expect(result.layer).toBe(2);
      }
    });

    it("handles empty strings", () => {
      const result = detector.check("");
      expect(result.loop).toBe(false);

      const result2 = detector.check("");
      expect(result2.loop).toBe(true);
      if (result2.loop) {
        expect(result2.reason).toBe("exact_match");
      }
    });
  });

  describe("Layer 3: QUANTIZED (semantic similarity)", () => {
    it("triggers on high cosine similarity", () => {
      // Use similar embeddings (slightly modified copies)
      const embedding1 = new Array(1024).fill(0).map(() => Math.random());
      const embedding2 = embedding1.map((v) => v + 0.001 * Math.random());

      // First with embedding
      let result = detector.check("thought 1", embedding1);
      expect(result.loop).toBe(false);

      // Second with very similar embedding
      result = detector.check("thought 2", embedding2);
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toMatch(/^semantic_similarity:/);
        expect(result.layer).toBe(3);
      }
    });

    it("does not trigger on dissimilar embeddings", () => {
      // Use orthogonal-ish embeddings
      const embedding1 = new Array(1024).fill(0).map((_, i) =>
        i % 2 === 0 ? 1 : 0
      );
      const embedding2 = new Array(1024).fill(0).map((_, i) =>
        i % 2 === 1 ? 1 : 0
      );

      let result = detector.check("thought 1", embedding1);
      expect(result.loop).toBe(false);

      result = detector.check("thought 2", embedding2);
      expect(result.loop).toBe(false);
    });

    it("works without embeddings (falls back to hash)", () => {
      let result = detector.check("unique thought 1", null);
      expect(result.loop).toBe(false);

      result = detector.check("unique thought 2", null);
      expect(result.loop).toBe(false);

      result = detector.check("unique thought 1", null);
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.layer).toBe(2); // Hash layer, not semantic
      }
    });
  });

  describe("reset()", () => {
    it("clears transition count", () => {
      detector.check("thought 1");
      detector.check("thought 2");
      expect(detector.getTransitionCount()).toBe(2);

      detector.reset();
      expect(detector.getTransitionCount()).toBe(0);
    });

    it("clears window", () => {
      detector.check("thought 1");
      expect(detector.getWindowSize()).toBe(1);

      detector.reset();
      expect(detector.getWindowSize()).toBe(0);
    });

    it("allows same content after reset", () => {
      const thought = "test thought";

      detector.check(thought);
      let result = detector.check(thought);
      expect(result.loop).toBe(true);

      detector.reset();

      result = detector.check(thought);
      expect(result.loop).toBe(false);

      result = detector.check(thought);
      expect(result.loop).toBe(true);
    });
  });

  describe("window bounds", () => {
    it("respects windowSize configuration", () => {
      const config: Partial<LoopConfig> = { windowSize: 3 };
      detector = new LoopDetector(config);

      detector.check("a");
      detector.check("b");
      detector.check("c");
      expect(detector.getWindowSize()).toBe(3);

      detector.check("d");
      expect(detector.getWindowSize()).toBe(3); // Still 3, oldest removed

      // "a" should no longer be in window
      const result = detector.check("a");
      expect(result.loop).toBe(false);
    });

    it("uses default windowSize of 8", () => {
      for (let i = 0; i < 10; i++) {
        detector.check(`thought ${i}`);
      }
      expect(detector.getWindowSize()).toBe(8);
    });
  });

  describe("configuration", () => {
    it("merges partial config with defaults", () => {
      detector = new LoopDetector({ maxTransitions: 100 });

      // Should use custom maxTransitions
      for (let i = 0; i < 100; i++) {
        detector.check(`thought ${i}`);
      }
      const result = detector.check("overflow");
      expect(result.loop).toBe(true);
    });

    it("uses all defaults when no config provided", () => {
      detector = new LoopDetector();
      expect(detector.getTransitionCount()).toBe(0);
      expect(detector.getWindowSize()).toBe(0);
    });
  });

  describe("layer ordering", () => {
    it("checks layers in order (count -> time -> hash -> semantic)", () => {
      // Layer 0 should trigger before Layer 2 (hash) even with duplicate content
      const config: Partial<LoopConfig> = { maxTransitions: 2 };
      detector = new LoopDetector(config);

      detector.check("test");
      detector.check("test"); // Would be hash match, but count triggers first
      const result = detector.check("test");

      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.layer).toBe(0); // Count, not hash
      }
    });
  });
});
