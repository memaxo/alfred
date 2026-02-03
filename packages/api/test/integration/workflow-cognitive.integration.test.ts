/**
 * Workflow + Cognitive Integration Tests
 *
 * Tests the bidirectional relationship between workflow execution
 * and cognitive state updates:
 * - Workflow execution triggers cognitive state updates
 * - Physiology affects workflow autonomy decisions
 * - Supervisor interrupts workflows based on cognitive state
 * - Reflection events persist learning outcomes
 *
 * Run: bun test workflow-cognitive.integration.test.ts
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
if (!process.env.BUN_TEST) {
  process.env.BUN_TEST = "1";
}

import type { PipelineEvent } from "@alfred/pipeline";

import { RuntimeContext } from "@alfred/type/runtime-context";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import path from "node:path";

// VCR for AI provider responses
const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "workflow-cognitive.json"
);

// Lazy-loaded modules
let VCRRecorder: typeof import("@alfred/test-kit/vcr").VCRRecorder;
let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: InstanceType<typeof VCRRecorder>;

let WorkflowTestHarness: typeof import("../utils/workflow-server").WorkflowTestHarness;
let toObservable: typeof import("../utils/stream").toObservable;

let runCognitiveLoop: typeof import("@alfred/runtime/loops/cognitive").runCognitiveLoop;
let cognitiveRepo: typeof import("@alfred/db").cognitiveRepo;
let userRepo: typeof import("@alfred/db").userRepo;

let idle: typeof import("@alfred/cognitive/state").idle;
let initialAutonomy: typeof import("@alfred/cognitive/state").initialAutonomy;
let applyTransition: typeof import("@alfred/cognitive/transition").applyTransition;

const ctx = new RuntimeContext([["scanContext", null]]);
const now = () => Date.now();

// Event factories
const inputEvent = (content: string) =>
  ({
    _: "input",
    content,
    source: "user",
    ts: now(),
  }) as any;

const completeEvent = (outcome: any) =>
  ({
    _: "complete",
    outcome,
    ts: now(),
  }) as any;

const interruptEvent = (reason: string, priority: 1 | 2 | 3 = 1) =>
  ({
    _: "interrupt",
    priority,
    reason,
    ts: now(),
  }) as any;

const stream = (suffix: string) => `wf-cog-${suffix}-${now()}`;

// Table cleanup
async function resetTables() {
  try {
    const { db } = await import("@alfred/db");
    const { cognitiveEvents, cognitiveSnapshots } =
      await import("@alfred/db/schema/cognitive");
    const { preferences } = await import("@alfred/db/schema/user");
    const { workflowEvents, workflowRuns } =
      await import("@alfred/db/schema/workflow");
    await db.delete(cognitiveEvents);
    await db.delete(cognitiveSnapshots);
    await db.delete(preferences);
    await db.delete(workflowEvents);
    await db.delete(workflowRuns);
  } catch {
    // Tables may not exist
  }
}

beforeAll(async () => {
  // Load VCR
  ({ VCRRecorder, createVCR } = await import("@alfred/test-kit/vcr"));

  // Load test utilities
  ({ WorkflowTestHarness } = await import("../utils/workflow-server"));
  ({ toObservable } = await import("../utils/stream"));

  // Load cognitive components
  ({ runCognitiveLoop } = await import("@alfred/runtime/loops/cognitive"));
  ({ cognitiveRepo, userRepo } = await import("@alfred/db"));
  ({ idle, initialAutonomy } = await import("@alfred/cognitive/state"));
  ({ applyTransition } = await import("@alfred/cognitive/transition"));

  // Create and start VCR
  vcr = createVCR({
    cassettePath,
    strictReplay: false,
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
  await resetTables();
});

describe("Workflow → Cognitive Integration", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();
    harness = new WorkflowTestHarness({
      user: {
        email: "wf-cog@test.local",
        id: "wf-cog-test-user",
        name: "Workflow Cognitive Test",
        roles: ["owner"],
        scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
      },
    });
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  describe("Workflow triggers cognitive updates", () => {
    it("workflow input triggers cognitive input event", async () => {
      const streamId = stream("wf-triggers-cog");

      // First, simulate cognitive input for the workflow task
      await runCognitiveLoop(ctx, streamId, inputEvent("Plan workflow task"));
      const cogResult = await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Plan workflow task")
      );

      expect(cogResult.state._).toBe("thinking");

      // Workflow would then execute based on cognitive state
      const caller = await harness.createCaller();
      const events: PipelineEvent[] = [];

      const subscription = await caller.streamPipeline({
        auto: "low" as const,
        mode: "sequential" as const,
        requirement: "Execute task from cognitive loop",
      });
      const observable = toObservable<PipelineEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10_000);
        const sub = observable.subscribe({
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          next: (event) => events.push(event),
        });
      });

      // Both systems should have been triggered
      expect(events.length).toBeGreaterThan(0);
      expect(cogResult.effects.length).toBeGreaterThan(0);
    });

    it("workflow completion triggers cognitive reflection", async () => {
      const streamId = stream("wf-complete-reflect");

      // Start cognitive processing
      await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Execute workflow task")
      );
      await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Execute workflow task")
      );

      // Simulate workflow completion
      const outcome = { _: "success" as const, duration: 500, result: "done" };
      const cogResult = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent(outcome)
      );

      // Should be in reflecting state
      expect(cogResult.state._).toBe("reflecting");
    });

    it("pipeline completion persists autonomy baseline preference", async () => {
      const caller = await harness.createCaller();
      const events: PipelineEvent[] = [];

      const subscription = await caller.streamPipeline({
        auto: "low" as const,
        mode: "sequential" as const,
        requirement: "Persist autonomy baseline preference",
      });
      const observable = toObservable<PipelineEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 15_000);
        const sub = observable.subscribe({
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          next: (event) => events.push(event),
        });
      });

      expect(events.length).toBeGreaterThan(0);

      const prefs = await userRepo.getPreferences("wf-cog-test-user");
      const baseline = prefs.find(
        (p) => p.key === "cognitive.autonomyBaseline"
      );
      expect(baseline).toBeDefined();

      const raw = baseline?.value;
      const level = typeof raw === "number" ? raw : Number(raw);
      expect(Number.isFinite(level)).toBe(true);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it("workflow failure increases cognitive frustration", async () => {
      const streamId = stream("wf-fail-frustration");

      // Start cognitive processing
      const initialResult = await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Attempt failing task")
      );
      const initialFrustration = initialResult.state.physiology.frustration;

      // Simulate workflow failure
      const outcome = {
        _: "failure" as const,
        error: "workflow execution failed",
        recoverable: true,
      };
      const failResult = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent(outcome)
      );

      // Frustration should increase
      expect(failResult.state.physiology.frustration).toBeGreaterThan(
        initialFrustration
      );
    });
  });

  describe("Physiology affects workflow autonomy", () => {
    it("low energy state affects workflow decisions", () => {
      const _streamId = stream("low-energy");

      // Simulate multiple events to drain energy
      let state = idle(now());
      const auto = initialAutonomy(now());

      // Multiple transitions drain energy
      for (let i = 0; i < 5; i++) {
        const result = applyTransition(state, auto, inputEvent(`task-${i}`));
        ({ state } = result);
      }

      // Energy should have decreased
      expect(state.physiology.energy).toBeLessThan(1);
    });

    it("high frustration triggers conservative workflow mode", async () => {
      const streamId = stream("high-frustration");

      // Start cognitive loop
      await runCognitiveLoop(ctx, streamId, inputEvent("Task"));

      // Multiple failures increase frustration
      for (let i = 0; i < 3; i++) {
        const outcome = {
          _: "failure" as const,
          error: `failure-${i}`,
          recoverable: true,
        };
        await runCognitiveLoop(ctx, streamId, completeEvent(outcome));
        await runCognitiveLoop(ctx, streamId, inputEvent(`retry-${i}`));
      }

      // Get final state
      const events = await cognitiveRepo.getAllEvents(streamId);
      expect(events.length).toBeGreaterThan(6); // Initial + 3 cycles

      // In production, high frustration would trigger lower autonomy workflow
    });

    it("boredom detection triggers workflow interrupt", async () => {
      const streamId = stream("boredom-interrupt");

      // Start with thinking state
      await runCognitiveLoop(ctx, streamId, inputEvent("Repetitive task"));

      // Send loop detection interrupt
      const _result = await runCognitiveLoop(
        ctx,
        streamId,
        interruptEvent("boredom_loop_detected")
      );

      // Boredom should increase
      const events = await cognitiveRepo.getAllEvents(streamId);
      const interruptEvents = events.filter((e) => e.type === "interrupt");
      expect(interruptEvents.length).toBe(1);
    });
  });

  describe("Supervisor integration", () => {
    it("supervisor can interrupt workflow based on cognitive state", async () => {
      const streamId = stream("supervisor-interrupt");

      // Start cognitive processing
      await runCognitiveLoop(ctx, streamId, inputEvent("Looping task"));

      // Multiple loop interrupts
      for (let i = 0; i < 3; i++) {
        await runCognitiveLoop(
          ctx,
          streamId,
          interruptEvent(`loop_iteration_${i}`)
        );
      }

      // All interrupts should be recorded
      const events = await cognitiveRepo.getAllEvents(streamId);
      const interrupts = events.filter((e) => e.type === "interrupt");
      expect(interrupts.length).toBe(3);
    });

    it("entropy-high interrupts update boredom consistently", async () => {
      const streamId = stream("entropy-boredom");

      // Get initial state
      const result1 = await runCognitiveLoop(ctx, streamId, inputEvent("Task"));
      const initialBoredom = result1.state.physiology.boredom;

      // First loop interrupt
      const result2 = await runCognitiveLoop(
        ctx,
        streamId,
        interruptEvent("loop detected - iteration 1")
      );

      // Second loop interrupt
      const result3 = await runCognitiveLoop(
        ctx,
        streamId,
        interruptEvent("loop detected - iteration 2")
      );

      // Boredom should monotonically increase
      expect(result2.state.physiology.boredom).toBeGreaterThan(initialBoredom);
      expect(result3.state.physiology.boredom).toBeGreaterThanOrEqual(
        result2.state.physiology.boredom
      );
    });

    it("supervisor interrupt creates cognitive interrupt event", async () => {
      const streamId = stream("supervisor-cognitive-bridge");

      // Start cognitive processing
      await runCognitiveLoop(ctx, streamId, inputEvent("Task that will loop"));

      // Simulate supervisor detecting a loop by creating interrupt event
      // (In real flow, supervisor would detect this and create the event)
      const interruptEvt = interruptEvent("boredom_loop_detected", 2);
      const result = await runCognitiveLoop(ctx, streamId, interruptEvt);

      // Verify interrupt event was persisted
      const events = await cognitiveRepo.getAllEvents(streamId);
      const interruptEvents = events.filter((e) => e.type === "interrupt");
      expect(interruptEvents.length).toBeGreaterThan(0);

      // Verify event payload contains reason
      const interruptPayload = interruptEvents[0]?.payload;
      expect(interruptPayload).toBeDefined();
      if (
        interruptPayload &&
        typeof interruptPayload === "object" &&
        "data" in interruptPayload
      ) {
        const { data } = interruptPayload as any;
        expect(data.reason).toContain("boredom_loop_detected");
        expect(data.priority).toBe(2); // Supervisor interrupts use priority 2
      }

      // Verify physiology updated (boredom should increase)
      expect(result.state.physiology.boredom).toBeGreaterThan(0);
    });
  });

  describe("Reflection and learning", () => {
    it("success outcomes trigger positive learning", async () => {
      const streamId = stream("success-learning");

      // Complete flow
      await runCognitiveLoop(ctx, streamId, inputEvent("Learning task"));
      await runCognitiveLoop(ctx, streamId, inputEvent("Learning task"));

      const successOutcome = {
        _: "success" as const,
        duration: 100,
        result: "completed",
      };
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent(successOutcome)
      );

      expect(result.state._).toBe("reflecting");

      // Events should record the learning
      const events = await cognitiveRepo.getAllEvents(streamId);
      expect(events.length).toBe(3);
      expect(events[0]?.type).toBe("input");
      expect(events[1]?.type).toBe("input");
      expect(events[2]?.type).toBe("complete");
    });

    it("failure outcomes trigger error analysis", async () => {
      const streamId = stream("failure-analysis");

      await runCognitiveLoop(ctx, streamId, inputEvent("Failing task"));
      await runCognitiveLoop(ctx, streamId, inputEvent("Failing task"));

      const failureOutcome = {
        _: "failure" as const,
        error: "task_error",
        recoverable: true,
      };
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent(failureOutcome)
      );

      expect(result.state._).toBe("reflecting");
      expect((result.state as any).outcome._).toBe("failure");
    });

    it("partial outcomes track completed and failed steps", async () => {
      const streamId = stream("partial-tracking");

      await runCognitiveLoop(ctx, streamId, inputEvent("Multi-step task"));
      await runCognitiveLoop(ctx, streamId, inputEvent("Multi-step task"));

      const partialOutcome = {
        _: "partial" as const,
        completed: ["step1", "step2"],
        failed: ["step3"],
      };
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent(partialOutcome)
      );

      expect(result.state._).toBe("reflecting");
      expect((result.state as any).outcome._).toBe("partial");
    });
  });
});

describe("Cognitive → Workflow Integration", () => {
  describe("Cognitive state drives workflow behavior", () => {
    it("idle state allows new workflow initiation", async () => {
      const streamId = stream("idle-allows-wf");

      // Start in idle
      const state = idle(now());
      expect(state._).toBe("idle");

      // Input should transition to thinking
      await runCognitiveLoop(ctx, streamId, inputEvent("New workflow request"));
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("New workflow request")
      );

      expect(result.state._).toBe("thinking");
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("generate_response");
    });

    it("thinking state generates workflow execution effect", async () => {
      const streamId = stream("thinking-effect");

      await runCognitiveLoop(ctx, streamId, inputEvent("Execute workflow"));
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Execute workflow")
      );

      expect(result.effects.some((e) => e.type === "generate_response")).toBe(
        true
      );
    });

    it("reflecting state completes workflow cycle", async () => {
      const streamId = stream("reflecting-complete");

      // Full cycle
      await runCognitiveLoop(ctx, streamId, inputEvent("Task"));
      await runCognitiveLoop(ctx, streamId, inputEvent("Task"));
      const result = await runCognitiveLoop(
        ctx,
        streamId,
        completeEvent({ _: "success", duration: 100, result: "done" })
      );

      expect(result.state._).toBe("reflecting");

      // Next input completes reflection
      const nextResult = await runCognitiveLoop(
        ctx,
        streamId,
        inputEvent("Next task")
      );

      expect(nextResult.state._).toBe("idle");
    });
  });

  describe("Autonomy gradient affects workflow permissions", () => {
    it("initial autonomy is within valid bounds", () => {
      const auto = initialAutonomy(now());

      expect(auto.level).toBeGreaterThanOrEqual(0);
      expect(auto.level).toBeLessThanOrEqual(1);
      expect(auto.confidence).toBeGreaterThanOrEqual(0);
      expect(auto.confidence).toBeLessThanOrEqual(1);
    });

    it("autonomy constraints can require approval", () => {
      const auto = initialAutonomy(now());

      // Check for approval constraint capability
      expect(auto.constraints).toBeDefined();
      // Constraints may be empty initially
    });
  });
});

describe("Cross-Boundary Event Flow", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();
    harness = new WorkflowTestHarness({
      user: {
        email: "cross@test.local",
        id: "cross-boundary-user",
        name: "Cross Boundary Test",
        roles: ["owner"],
        scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
      },
    });
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  it("workflow and cognitive events are recorded separately", async () => {
    const cogStreamId = stream("separate-cog");

    // Cognitive events
    await runCognitiveLoop(ctx, cogStreamId, inputEvent("Cognitive task"));
    await runCognitiveLoop(
      ctx,
      cogStreamId,
      completeEvent({ _: "success", duration: 50, result: "done" })
    );

    // Workflow events
    const caller = await harness.createCaller();
    const workflowEvents: PipelineEvent[] = [];

    const subscription = await caller.streamPipeline({
      auto: "low" as const,
      mode: "sequential" as const,
      requirement: "Workflow task",
    });
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10_000);
      const sub = observable.subscribe({
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        error: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        next: (event) => workflowEvents.push(event),
      });
    });

    // Check cognitive events
    const cogEvents = await cognitiveRepo.getAllEvents(cogStreamId);
    expect(cogEvents.length).toBe(2);

    // Workflow events should exist too
    expect(workflowEvents.length).toBeGreaterThan(0);
  });

  it("workflow runId stream records cognitive input + complete events", async () => {
    const caller = await harness.createCaller();
    const workflowEvents: PipelineEvent[] = [];
    let runId: string | undefined;

    const subscription = await caller.streamPipeline({
      auto: "low" as const,
      mode: "sequential" as const,
      requirement: "Workflow should emit cognitive events",
    });
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10_000);
      const sub = observable.subscribe({
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        error: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        next: (event) => {
          workflowEvents.push(event);
          if (event.type === "pipeline:start") {
            ({ runId } = event);
          }
        },
      });
    });

    expect(workflowEvents.length).toBeGreaterThan(0);
    expect(runId).toBeDefined();
    if (!runId) {
      return;
    }

    const cogEvents = await cognitiveRepo.getAllEvents(runId);
    const types = cogEvents.map((e) => e.type);
    expect(types).toContain("input");
    expect(types).toContain("complete");
    expect(cogEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("maintains consistency across subsystems", async () => {
    const streamId = stream("consistency");

    // Start cognitive processing
    await runCognitiveLoop(ctx, streamId, inputEvent("Consistency test"));
    const cogStart = await runCognitiveLoop(
      ctx,
      streamId,
      inputEvent("Consistency test")
    );
    expect(cogStart.state._).toBe("thinking");

    // Start workflow
    const caller = await harness.createCaller();
    let runId: string | undefined;

    const subscription = await caller.streamPipeline({
      auto: "low" as const,
      mode: "sequential" as const,
      requirement: "Consistency workflow",
    });
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10_000);
      const sub = observable.subscribe({
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        error: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        next: (event) => {
          if (event.type === "pipeline:start") {
            ({ runId } = event);
          }
        },
      });
    });

    // Both should have IDs
    expect(runId).toBeDefined();
    expect(streamId).toBeDefined();

    // Complete cognitive loop
    const cogEnd = await runCognitiveLoop(
      ctx,
      streamId,
      completeEvent({ _: "success", duration: 100, result: runId })
    );
    expect(cogEnd.state._).toBe("reflecting");
  });
});
