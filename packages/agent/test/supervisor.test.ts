import { describe, expect, it, test } from "bun:test";
import { BrainstemSupervisor } from "../src/orchestrator/loops/supervisor";
import { detectLoop, calculateSimilarity } from "../src/utils/entropy";

describe("Brainstem Supervisor", () => {
  describe("Entropy Utils", () => {
    it("calculates similarity correctly", () => {
      expect(calculateSimilarity("hello", "hello")).toBe(1.0);
      expect(calculateSimilarity("hello", "hella")).toBe(0.8); // 1 diff / 5
      expect(calculateSimilarity("abc", "xyz")).toBe(0.0);
    });

    it("detects immediate loops", () => {
      const window = ["I need to check file A", "I need to check file A"];
      expect(detectLoop(window)).toBe(true);
    });

    it("detects near-duplicate loops", () => {
      const window = [
        "I will verify the file content",
        "I will verify the file contents",
      ];
      // "content" vs "contents" -> 1 char diff. Length 30 vs 31.
      // 1 - 1/31 ~= 0.96 > 0.8
      expect(detectLoop(window)).toBe(true);
    });

    it("detects ping-pong loops (A-B-A)", () => {
      const window = [
        "Check status",
        "Status is pending",
        "Check status",
      ];
      expect(detectLoop(window)).toBe(true);
    });

    it("ignores valid progression", () => {
      const window = [
        "Check status",
        "Status is pending",
        "Wait for completion",
      ];
      expect(detectLoop(window)).toBe(false);
    });
  });

  describe("Supervisor Class", () => {
    it("triggers interrupt on loop", () => {
      const supervisor = new BrainstemSupervisor();
      
      supervisor.observe({ type: "thought", content: "Thinking about X" });
      supervisor.observe({ type: "thought", content: "Checking Y" });
      
      const result = supervisor.observe({ type: "thought", content: "Thinking about X" });
      expect(result.interrupt).toBe(true);
      if (result.interrupt) {
          expect(result.reason).toBe("boredom_loop_detected");
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
      await new Promise(resolve => setTimeout(resolve, 150));
      
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
      
      await new Promise(resolve => setTimeout(resolve, 100));
      supervisor.heartbeat();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      // Total 200ms passed, but heartbeat reset at 100ms.
      // Silence duration is only 100ms.
      
      const check = supervisor.checkPhysiology();
      expect(check.interrupt).toBe(false);
    });
  });
});
