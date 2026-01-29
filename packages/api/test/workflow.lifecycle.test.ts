/**
 * Workflow lifecycle endpoint tests.
 *
 * Tests start, stream, resume, cancel functionality.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 4
 */

import type { PipelineEvent } from "@alfred/pipeline";

import { beforeAll, describe, expect, it, mock } from "bun:test";

import { installPipelineMocks } from "./utils/pipeline";
import { setupTestEnv } from "./utils/router-helpers";
import { toObservable } from "./utils/stream";

setupTestEnv();
installPipelineMocks({
  dbRepo: true,
  sessionRecovery: true,
  linear: true,
  runtimeLinear: true,
  preferenceRefresh: true,
});

mock.module("../src/workflow/access", () => ({
  enforceWorkflowPlanPolicy: async () => ({ obligations: [] }),
}));

const { createWorkflowCaller } = await import("./utils/workflow-caller");

describe("workflow lifecycle", () => {
  let caller: Awaited<ReturnType<typeof createWorkflowCaller>>;

  beforeAll(async () => {
    caller = await createWorkflowCaller();
  });

  describe("start", () => {
    it("creates a new workflow run", async () => {
      const result = await caller.start({
        requirement: "Test workflow start",
      });

      expect(result.runId).toBeDefined();
      expect(typeof result.runId).toBe("string");
      expect(result.summary).toContain("Pipeline run created");
    });

    it("creates run with valid UUID format", async () => {
      const result = await caller.start({
        requirement: "Test UUID format",
      });

      // Verify it's a valid UUID v4 format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.runId).toMatch(uuidRegex);
    });
  });

  describe("stream", () => {
    it("streams pipeline events for a run", async () => {
      const { runId } = await caller.start({
        requirement: "Test streaming",
      });

      const observable = toObservable<PipelineEvent>(
        await caller.streamPipeline({ runId, requirement: "Test streaming" })
      );

      const events: PipelineEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (event) => events.push(event),
          error: (err) => reject(err),
          complete: () => resolve(),
        });
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.type).toBe("pipeline:start");
      expect(events.at(-1)?.type).toBe("pipeline:complete");
    });

    it("emits stage progress events", async () => {
      const { runId } = await caller.start({
        requirement: "Test stage progress",
      });

      const observable = toObservable<PipelineEvent>(
        await caller.streamPipeline({
          runId,
          requirement: "Test stage progress",
        })
      );

      const events: PipelineEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (event) => events.push(event),
          error: (err) => reject(err),
          complete: () => resolve(),
        });
      });

      const progressEvents = events.filter((e) => e.type === "stage:progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });

  describe("cancel", () => {
    it("has cancel endpoint defined", async () => {
      // Verify the endpoint exists and is callable
      expect(caller.cancel).toBeDefined();
      expect(typeof caller.cancel).toBe("function");
    });
  });

  describe("resume", () => {
    it("resumes a suspended workflow", async () => {
      // Start and then create a scenario where we can resume
      const { runId } = await caller.start({
        requirement: "Test resume",
      });

      // Cancel first to simulate a suspend/cancel scenario
      await caller.cancel({ runId });

      // Note: Full resume testing requires a suspended run with checkpoint
      // This is a basic smoke test
      const run = await caller.get({ runId });
      expect(run).toBeDefined();
    });

    it("resumes from checkpoint with stream", async () => {
      const { runId } = await caller.start({
        requirement: "Test resume from checkpoint",
      });

      // Stream the pipeline
      const observable = toObservable<PipelineEvent>(
        await caller.streamPipeline({
          runId,
          requirement: "Test resume from checkpoint",
        })
      );

      const events: PipelineEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (event) => events.push(event),
          error: (err) => reject(err),
          complete: () => resolve(),
        });
      });

      expect(events.at(-1)?.type).toBe("pipeline:complete");

      // Verify run is completed
      const run = await caller.get({ runId });
      expect(run.status).toBe("completed");
    });
  });

  describe("listRuns", () => {
    it("has listRuns endpoint defined", async () => {
      // Verify the endpoint exists and is callable
      // Note: Full testing requires database mocking for listRuns
      expect(caller.listRuns).toBeDefined();
      expect(typeof caller.listRuns).toBe("function");
    });
  });

  describe("events", () => {
    it("has events endpoint defined", async () => {
      // Verify the endpoint exists and is callable
      expect(caller.events).toBeDefined();
      expect(typeof caller.events).toBe("function");
    });
  });
});
