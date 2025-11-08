import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import { runPlanV6, type RunPlanInput } from "../../src/workflow/runner";

describe("workflow runner", () => {
  describe("runPlanV6", () => {
    it("creates a workflow run with unique ID", () => {
      const input: RunPlanInput = {
        requirement: "test requirement",
        auto: "low",
      };

      const runner = runPlanV6(input);

      expect(runner.runId).toBeDefined();
      expect(typeof runner.runId).toBe("string");
      expect(runner.summary).toContain("test requirement");
    });

    it("emits run event first", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
        if (events.length >= 3) break;
      }

      expect(events[0]).toMatchObject({
        type: "run",
      });
    });

    it("emits progress events", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
        if (events.length >= 10) break;
      }

      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it("handles context preparation when enabled", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
        context: {
          enable: true,
        },
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      const contextEvents = events.filter((e) => e.type === "context");
      expect(contextEvents.length).toBeGreaterThan(0);
    });

    it("skips context when disabled", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
        context: {
          enable: false,
        },
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      const contextEvents = events.filter((e) => e.type === "context");
      expect(contextEvents.length).toBe(0);
    });

    it("requests elevated scopes for medium autonomy", async () => {
      const runner = runPlanV6(
        {
          requirement: "test",
          auto: "medium",
        },
        { workflowTimeoutMs: 1000 }
      );

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
        if (events.length >= 10) {
          runner.cancel();
          break;
        }
      }

      const requireScopeEvents = events.filter(
        (e) => e.type === "require-scope"
      );
      expect(requireScopeEvents.length).toBeGreaterThan(0);
    });

    it("requests elevated scopes for high autonomy", async () => {
      const runner = runPlanV6(
        {
          requirement: "test",
          auto: "high",
        },
        { workflowTimeoutMs: 1000 }
      );

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
        if (events.length >= 10) {
          runner.cancel();
          break;
        }
      }

      const requireScopeEvents = events.filter(
        (e) => e.type === "require-scope"
      );
      expect(requireScopeEvents.length).toBeGreaterThan(0);
    });

    it("does not request scopes for low autonomy", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      const requireScopeEvents = events.filter(
        (e) => e.type === "require-scope"
      );
      expect(requireScopeEvents.length).toBe(0);
    });

    it("supports cancellation via AbortSignal", async () => {
      const abortController = new AbortController();
      const runner = runPlanV6(
        {
          requirement: "test",
          auto: "low",
        },
        { signal: abortController.signal }
      );

      const events: WorkflowEvent[] = [];
      const streamPromise = (async () => {
        for await (const event of runner.stream) {
          events.push(event);
        }
      })();

      abortController.abort();
      await streamPromise;

      expect(events.length).toBeLessThan(10);
    });

    it("supports resume with payload", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "medium",
      });

      await runner.resume({
        event: "bio-authz",
        authz: "token-123",
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      const noticeEvents = events.filter((e) => e.type === "notice");
      const acknowledged = noticeEvents.some((e) =>
        e.message?.includes("acknowledged")
      );
      expect(acknowledged).toBe(true);
    });

    it("supports cancel method", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
      });

      runner.cancel();

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      expect(events.length).toBeLessThan(10);
    });

    it("completes workflow successfully", async () => {
      const runner = runPlanV6({
        requirement: "test",
        auto: "low",
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runner.stream) {
        events.push(event);
      }

      const lastEvent = events[events.length - 1];
      expect(lastEvent).toMatchObject({
        type: "progress",
        pct: 100,
        message: "workflow_completed",
      });
    });
  });
});

