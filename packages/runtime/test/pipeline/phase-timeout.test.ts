import { RuntimeContext } from "@alfred/type/runtime-context";
import { describe, expect, it } from "bun:test";

import type { Phase, PipelineState } from "../../src/pipeline/types";

import { PhaseRunner, PhaseTimeoutError } from "../../src/pipeline/runner";

const createState = (): PipelineState => ({
  currentPhaseId: "start",
  context: new RuntimeContext(),
  history: [],
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("PhaseRunner phase timeouts", () => {
  it("throws PhaseTimeoutError when a phase exceeds its timeout", async () => {
    const state = createState();
    const runner = new PhaseRunner(state, {
      phaseTimeouts: { start: 10 },
      defaultPhaseTimeoutMs: 10,
    });

    const slowPhase: Phase<unknown, unknown> = {
      id: "start",
      async *run() {
        yield* [];
        await delay(25);
        return { status: "success", data: null };
      },
    };

    runner.register(slowPhase);

    const consume = async () => {
      for await (const _ of runner.run({})) {
        // drain generator
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(PhaseTimeoutError);
    expect(state.history.at(-1)).toMatchObject({
      phaseId: "start",
      result: "failure",
    });
  });

  it("completes when the phase finishes before the timeout", async () => {
    const state = createState();
    const runner = new PhaseRunner(state, {
      phaseTimeouts: { start: 100 },
      defaultPhaseTimeoutMs: 100,
    });

    const fastPhase: Phase<unknown, unknown> = {
      id: "start",
      async *run() {
        yield* [];
        await delay(5);
        return { status: "success", data: null };
      },
    };

    runner.register(fastPhase);

    const consume = async () => {
      for await (const _ of runner.run({})) {
        // drain generator
      }
    };

    await expect(consume()).resolves.toBeUndefined();
    expect(state.history.at(-1)).toMatchObject({
      phaseId: "start",
      result: "success",
    });
  });
});
