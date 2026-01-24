import { LoopDetector } from "@alfred/cognitive";
import { describe, expect, it } from "bun:test";

import { BrainstemSupervisor } from "../src/orchestrator/loops/supervisor";

describe("Brainstem Supervisor", () => {
  describe("LoopDetector (recommended)", () => {
    it("detects exact match loops", () => {
      const detector = new LoopDetector();
      const thought = "I need to check file A";

      let result = detector.check(thought);
      expect(result.loop).toBe(false);

      result = detector.check(thought);
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toBe("exact_match");
        expect(result.layer).toBe(2);
      }
    });

    it("detects semantic loops with embeddings", () => {
      const detector = new LoopDetector();
      const baseEmbedding = new Array(1024).fill(0).map(() => Math.random());
      const similarEmbedding = baseEmbedding.map(
        (v) => v + 0.001 * Math.random()
      );

      let result = detector.check("thought 1", baseEmbedding);
      expect(result.loop).toBe(false);

      result = detector.check("thought 2", similarEmbedding);
      expect(result.loop).toBe(true);
      if (result.loop) {
        expect(result.reason).toMatch(/^semantic_similarity:/);
        expect(result.layer).toBe(3);
      }
    });

    it("ignores valid progression", () => {
      const detector = new LoopDetector();
      const thoughts = [
        "Check status",
        "Status is pending",
        "Wait for completion",
      ];

      for (const thought of thoughts) {
        const result = detector.check(thought);
        expect(result.loop).toBe(false);
      }
    });
  });

  describe("Supervisor Class", () => {
    it("triggers interrupt on exact match loop", () => {
      const supervisor = new BrainstemSupervisor();

      supervisor.observe({ type: "thought", content: "Thinking about X" });
      supervisor.observe({ type: "thought", content: "Checking Y" });

      const result = supervisor.observe({
        type: "thought",
        content: "Thinking about X",
      });
      expect(result.interrupt).toBe(true);
      if (result.interrupt) {
        // New API uses exact_match reason
        expect(result.reason).toBe("exact_match");
      }
    });

    it("manages process heartbeats", async () => {
      const supervisor = new BrainstemSupervisor();
      const abortController = new AbortController();

      supervisor.registerProcess("proc-1", abortController, 100); // 100ms timeout

      // Should be fine initially
      let check = supervisor.checkPhysiology();
      expect(check.interrupt).toBe(false);

      // Wait > 100ms
      await new Promise((resolve) => setTimeout(resolve, 150));

      check = supervisor.checkPhysiology();
      expect(check.interrupt).toBe(true);
      if (check.interrupt) {
        expect(check.reason).toContain("process_heartbeat_failed");
      }
      expect(abortController.signal.aborted).toBe(true);
    });

    it("resets heartbeat on activity", async () => {
      const supervisor = new BrainstemSupervisor();
      const abortController = new AbortController();

      supervisor.registerProcess("proc-1", abortController, 200);

      await new Promise((resolve) => setTimeout(resolve, 100));
      supervisor.heartbeat();

      await new Promise((resolve) => setTimeout(resolve, 100));
      // Total 200ms passed, but heartbeat reset at 100ms.
      // Silence duration is only 100ms.

      const check = supervisor.checkPhysiology();
      expect(check.interrupt).toBe(false);
    });

    it("clears detector on clearProcess", () => {
      const supervisor = new BrainstemSupervisor();
      const abortController = new AbortController();

      supervisor.registerProcess("test", abortController);
      supervisor.observe({ type: "thought", content: "test" });
      expect(supervisor.getTransitionCount()).toBe(1);

      supervisor.clearProcess();
      expect(supervisor.getTransitionCount()).toBe(0);
    });
  });
});
