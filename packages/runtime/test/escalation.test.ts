import { describe, expect, it, mock } from "bun:test";
import { PipelineRunner } from "../src/pipeline/runner";
import type { Phase, PhaseResult, PipelineState } from "../src/pipeline/types";

class MockPhase implements Phase<any, any> {
  constructor(readonly id: string, private readonly config: any = {}) {}

  async *run(input: any, _context: any): AsyncGenerator<any, PhaseResult<any>, void> {
    yield { type: "step-start", phase: this.id };
    
    if (this.config.escalate) {
      // Only escalate once
      if (!this.config.escalated) {
        this.config.escalated = true;
        return { 
          status: "escalate", 
          reason: "test escalation", 
          targetPhase: this.config.target 
        };
      }
    }
    
    return { status: "success", data: "done" };
  }
}

describe("PipelineRunner Escalation", () => {
  it("handles escalation by switching phases", async () => {
    const state: PipelineState = {
      currentPhaseId: "act",
      history: [],
      context: {} as any,
    };
    
    const actConfig = { escalate: true, target: "plan", escalated: false };
    const planConfig = { escalate: false };
    
    const runner = new PipelineRunner(state);
    runner.register(new MockPhase("act", actConfig));
    runner.register(new MockPhase("plan", planConfig));

    const generator = runner.run("input");
    const events = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Expected flow:
    // 1. Act starts (step-start)
    // 2. Act yields event
    // 3. Act escalates
    // 4. Plan starts (step-start)
    // 5. Plan yields event
    // 6. Plan succeeds (step-complete)
    
    // We capture 5 events because mock yields one extra per phase
    // act-start, act-event, plan-start, plan-event, plan-complete
    // Actually 5 is correct.
    
    expect(events).toHaveLength(5);
    expect(events[0].phase).toBe("act"); // start
    expect(events[2].phase).toBe("plan"); // start
    expect(events[4].phase).toBe("plan"); // complete
    
    expect(state.history).toHaveLength(2);
    expect(state.history[0].phaseId).toBe("act");
    expect(state.history[0].result).toBe("escalate");
    expect(state.history[1].phaseId).toBe("plan");
    expect(state.history[1].result).toBe("success");
  });
});
