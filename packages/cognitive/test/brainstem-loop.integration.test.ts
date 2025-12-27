import { beforeEach, describe, expect, it } from "bun:test";
import { BrainstemSupervisor } from "../src/brainstem";

describe("BrainstemSupervisor Loop Detection Integration", () => {
  let supervisor: BrainstemSupervisor;

  beforeEach(() => {
    supervisor = new BrainstemSupervisor();
  });

  describe("semantic similarity detection", () => {
    it("triggers interrupt on repeated similar thoughts with embeddings", () => {
      // Create similar embeddings
      const baseEmbedding = new Array(1024).fill(0).map(() => Math.random());
      const similarEmbedding = baseEmbedding.map(
        (v) => v + 0.001 * Math.random()
      );

      let result = supervisor.observe({
        type: "thought",
        content: "I need to analyze the configuration",
        embedding: baseEmbedding,
      });
      expect(result.interrupt).toBe(false);

      result = supervisor.observe({
        type: "thought",
        content: "Let me check the configuration settings",
        embedding: similarEmbedding,
      });
      expect(result.interrupt).toBe(true);
      if (result.interrupt) {
        expect(result.reason).toMatch(/^semantic_similarity:/);
      }
    });
  });

  describe("exact match detection", () => {
    it("triggers interrupt on exact thought repetition", () => {
      const thought = "Checking the file system for changes";

      let result = supervisor.observe({
        type: "thought",
        content: thought,
      });
      expect(result.interrupt).toBe(false);

      result = supervisor.observe({
        type: "thought",
        content: "A different thought in between",
      });
      expect(result.interrupt).toBe(false);

      result = supervisor.observe({
        type: "thought",
        content: thought,
      });
      expect(result.interrupt).toBe(true);
      if (result.interrupt) {
        expect(result.reason).toBe("exact_match");
      }
    });
  });

  describe("novel thoughts", () => {
    it("does not trigger interrupt on novel progression", () => {
      const thoughts = [
        "First, let me understand the problem",
        "Now I'll analyze the data structure",
        "The best approach seems to be recursive",
        "Implementing the solution step by step",
        "Testing the implementation",
      ];

      for (const content of thoughts) {
        const result = supervisor.observe({ type: "thought", content });
        expect(result.interrupt).toBe(false);
      }
    });
  });

  describe("heartbeat functionality", () => {
    it("maintains heartbeat state", () => {
      const abortController = new AbortController();
      supervisor.registerProcess("test-process", abortController, 60_000);

      // Heartbeat should not trigger interrupt
      supervisor.heartbeat();
      const physResult = supervisor.checkPhysiology();
      expect(physResult.interrupt).toBe(false);
    });

    it("detects heartbeat failure", async () => {
      const abortController = new AbortController();
      supervisor.registerProcess("test-process", abortController, 50);

      // Wait longer than heartbeat timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      const physResult = supervisor.checkPhysiology();
      expect(physResult.interrupt).toBe(true);
      if (physResult.interrupt) {
        expect(physResult.reason).toMatch(/^process_heartbeat_failed:/);
      }
    });
  });

  describe("clearProcess", () => {
    it("resets detector and process state", () => {
      // Add some history
      supervisor.observe({ type: "thought", content: "thought 1" });
      supervisor.observe({ type: "thought", content: "thought 2" });
      expect(supervisor.getTransitionCount()).toBe(2);

      const abortController = new AbortController();
      supervisor.registerProcess("test", abortController);

      supervisor.clearProcess();

      // Detector should be reset
      expect(supervisor.getTransitionCount()).toBe(0);

      // Process should be cleared (physiology check returns false)
      const physResult = supervisor.checkPhysiology();
      expect(physResult.interrupt).toBe(false);
    });
  });

  describe("tool events", () => {
    it("ignores tool_call events for loop detection", () => {
      const result = supervisor.observe({
        type: "tool_call",
        tool: "read_file",
        input: "config.json",
      });
      expect(result.interrupt).toBe(false);
    });

    it("ignores tool_result events for loop detection", () => {
      const result = supervisor.observe({
        type: "tool_result",
        content: '{"key": "value"}',
      });
      expect(result.interrupt).toBe(false);
    });
  });

  describe("configuration", () => {
    it("accepts custom loop config", () => {
      supervisor = new BrainstemSupervisor({
        loop: {
          maxTransitions: 3,
          windowSize: 2,
        },
      });

      supervisor.observe({ type: "thought", content: "a" });
      supervisor.observe({ type: "thought", content: "b" });
      supervisor.observe({ type: "thought", content: "c" });

      const result = supervisor.observe({ type: "thought", content: "d" });
      expect(result.interrupt).toBe(true);
      if (result.interrupt) {
        expect(result.reason).toBe("max_transitions");
      }
    });
  });
});
