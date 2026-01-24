import { RuntimeContext } from "@alfred/type/runtime-context";
import { describe, expect, it } from "bun:test";

import type { Phase, PipelineState } from "../src/pipeline/types";

import { PhaseRunner } from "../src/pipeline/runner";

describe("PhaseRunner", () => {
  it("detects infinite escalation loops", async () => {
    const mockState: PipelineState = {
      currentPhaseId: "start",
      context: new RuntimeContext(),
      history: [],
    };
    const runner = new PhaseRunner(mockState);

    // Phase A escalates to Phase B
    const phaseA: Phase<any, any> = {
      id: "start",
      async *run() {
        yield { type: "text", content: "A running" } as any;
        return { status: "escalate", reason: "goto B", targetPhase: "phaseB" };
      },
    };

    // Phase B escalates to Phase A
    const phaseB: Phase<any, any> = {
      id: "phaseB",
      async *run() {
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
        if (res.done) {
          break;
        }
      }
      throw new Error("Should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("exceeded maximum transitions");
    }
  });
});
