import { describe, expect, it } from "bun:test";
import { PipelineRunner } from "../src/pipeline/runner";
import type { Phase, PhaseResult, PipelineState } from "../src/pipeline/types";

describe("PipelineRunner", () => {
  const mockContext = {} as any;
  const mockState: PipelineState = {
    currentPhaseId: "start",
    context: mockContext,
    history: [],
  };

  it("detects infinite escalation loops", async () => {
    const runner = new PipelineRunner(mockState);

    // Phase A escalates to Phase B
    const phaseA: Phase<any, any> = {
      id: "start",
      run: async function* () {
        yield { type: "text", content: "A running" } as any;
        return { status: "escalate", reason: "goto B", targetPhase: "phaseB" };
      },
    };

    // Phase B escalates to Phase A
    const phaseB: Phase<any, any> = {
      id: "phaseB",
      run: async function* () {
        yield { type: "text", content: "B running" } as any;
        return { status: "escalate", reason: "goto A", targetPhase: "start" };
      },
    };

    runner.register(phaseA).register(phaseB);

    const iterator = runner.run({});
    
    // We expect it to throw after MAX_TRANSITIONS
    try {
        while (true) {
            const res = await iterator.next();
            if (res.done) break;
        }
        throw new Error("Should have thrown");
    } catch (e: any) {
        expect(e.message).toContain("exceeded maximum transitions");
    }
  });
});
