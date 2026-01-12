import { describe, expect, it } from "bun:test";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { PipelineRunner } from "../src/pipeline/runner";
import type { Phase, PhaseResult, PipelineState } from "../src/pipeline/types";

class TestPhase implements Phase<string, string> {
  constructor(
    readonly id: string,
    private readonly nextPhase?: string
  ) {}

  async *run(
    input: string,
    _context: any
  ): AsyncGenerator<any, PhaseResult<string>, void> {
    yield { type: "test", message: `Running ${this.id} with ${input}` };

    if (this.nextPhase) {
      return {
        status: "escalate",
        reason: "next",
        targetPhase: this.nextPhase,
      };
    }
    return { status: "success", data: "done" };
  }
}

describe("PipelineRunner", () => {
  it("executes a single phase successfully", async () => {
    const state: PipelineState = {
      currentPhaseId: "phase1",
      history: [],
      context: new RuntimeContext(),
    };
    const runner = new PipelineRunner(state);
    runner.register(new TestPhase("phase1"));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(events).toHaveLength(3); // start + test + complete
    expect(events[0]).toEqual({ _: "step-start", phase: "phase1" });
    expect(events[1]).toEqual({
      type: "test",
      message: "Running phase1 with input",
    });
    expect(events[2]).toEqual({ _: "step-complete", phase: "phase1" });

    expect(state.history).toHaveLength(1);
    expect(state.history[0].result).toBe("success");
  });

  it("escalates to next phase", async () => {
    const state: PipelineState = {
      currentPhaseId: "phase1",
      history: [],
      context: new RuntimeContext(),
    };
    const runner = new PipelineRunner(state);
    runner.register(new TestPhase("phase1", "phase2"));
    runner.register(new TestPhase("phase2"));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    // phase1 (start, test, escalate) -> phase2 (start, test, complete)
    expect(events).toHaveLength(5);
    expect(events[0]).toEqual({ _: "step-start", phase: "phase1" });
    expect(events[1].type).toBe("test");
    expect(events[2]).toEqual({ _: "step-start", phase: "phase2" });
    expect(events[3].type).toBe("test");
    expect(events[4]).toEqual({ _: "step-complete", phase: "phase2" });

    expect(state.history).toHaveLength(2);
    expect(state.history[0].phaseId).toBe("phase1");
    expect(state.history[0].result).toBe("escalate");
    expect(state.history[1].phaseId).toBe("phase2");
    expect(state.history[1].result).toBe("success");
  });

  it("advances automatically to the next registered phase on success", async () => {
    const state: PipelineState = {
      currentPhaseId: "phase1",
      history: [],
      context: new RuntimeContext(),
    };

    const runner = new PipelineRunner(state);
    runner.register(new TestPhase("phase1"));
    runner.register(new TestPhase("phase2"));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(events).toHaveLength(6);
    expect(events[0]).toEqual({ _: "step-start", phase: "phase1" });
    expect(events[2]).toEqual({ _: "step-complete", phase: "phase1" });
    expect(events[3]).toEqual({ _: "step-start", phase: "phase2" });
    expect(events[5]).toEqual({ _: "step-complete", phase: "phase2" });

    expect(state.history).toHaveLength(2);
    expect(state.history[0].phaseId).toBe("phase1");
    expect(state.history[1].phaseId).toBe("phase2");
  });
});
