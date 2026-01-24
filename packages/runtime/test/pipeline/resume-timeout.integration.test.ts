import { RuntimeContext } from "@alfred/type/runtime-context";
import { describe, expect, it } from "bun:test";

import type { Phase, PipelineState } from "../../src/pipeline/types";

import { PhaseRunner, PhaseTimeoutError } from "../../src/pipeline/runner";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createState = (phaseId: string): PipelineState => ({
  currentPhaseId: phaseId,
  history: [],
  context: new RuntimeContext(),
});

describe("PhaseRunner resume integration", () => {
  it("enforces timeouts when resuming mid-pipeline", async () => {
    const state = createState("plan");
    state.history.push({
      phaseId: "scan",
      result: "success",
      timestamp: Date.now() - 1000,
    });

    const scanPhase: Phase<unknown, unknown> = {
      id: "scan",
      async *run() {
        await Promise.resolve();
        yield* [];
        return { status: "success", data: null };
      },
    };

    const planPhase: Phase<unknown, unknown> = {
      id: "plan",
      async *run() {
        yield* [];
        await delay(25);
        return { status: "success", data: null };
      },
    };

    const runner = new PhaseRunner(state, {
      phaseTimeouts: { plan: 10 },
    })
      .register(scanPhase)
      .register(planPhase);

    const consume = async () => {
      for await (const _ of runner.run({})) {
        // drain
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(PhaseTimeoutError);
    expect(state.history.at(-1)).toMatchObject({
      phaseId: "plan",
      result: "failure",
    });
  });

  it("continues through remaining phases after resume when within timeout", async () => {
    const state = createState("plan");
    state.history.push({
      phaseId: "scan",
      result: "success",
      timestamp: Date.now() - 1000,
    });

    const planPhase: Phase<unknown, unknown> = {
      id: "plan",
      async *run() {
        yield* [];
        await delay(5);
        return { status: "success", data: null };
      },
    };

    const reportPhase: Phase<unknown, unknown> = {
      id: "report",
      async *run() {
        await Promise.resolve();
        yield* [];
        return { status: "success", data: null };
      },
    };

    const runner = new PhaseRunner(state, {
      phaseTimeouts: { plan: 50, report: 50 },
    })
      .register(planPhase)
      .register(reportPhase);

    const events: any[] = [];
    for await (const event of runner.run({})) {
      events.push(event);
    }

    expect(events.some((event) => event._ === "step-complete")).toBe(true);
    expect(state.history.at(-1)).toMatchObject({
      phaseId: "report",
      result: "success",
    });
  });
});
