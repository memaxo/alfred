import { describe, expect, it } from "bun:test";
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
      context: {} as any,
    };
    const runner = new PipelineRunner(state);
    runner.register(new TestPhase("phase1"));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(events).toHaveLength(2); // start + test
    expect(events[0]).toEqual({ type: "step-start", phase: "phase1" });
    expect(events[1]).toEqual({
      type: "test",
      message: "Running phase1 with input",
    });

    expect(state.history).toHaveLength(1);
    expect(state.history[0].result).toBe("success");
  });

  it("escalates to next phase", async () => {
    const state: PipelineState = {
      currentPhaseId: "phase1",
      history: [],
      context: {} as any,
    };
    const runner = new PipelineRunner(state);
    runner.register(new TestPhase("phase1", "phase2"));
    runner.register(new TestPhase("phase2"));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    // phase1 (start, test) -> escalate -> phase2 (start, test) -> success
    expect(events).toHaveLength(4);
    expect(events[0].type).toBe("step-start");
    expect(events[2].type).toBe("step-start");

    expect(state.history).toHaveLength(2);
    expect(state.history[0].phaseId).toBe("phase1");
    expect(state.history[0].result).toBe("escalate");
    expect(state.history[1].phaseId).toBe("phase2");
    expect(state.history[1].result).toBe("success");
  });
});
