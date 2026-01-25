import { describe, expect, test } from "bun:test";

import { runSteps } from "../src/runner.js";

describe("runSteps", () => {
  test("retries and attempts", async () => {
    let n = 0;
    const { ok, results } = await runSteps({
      runId: "test",
      config: {},
      timeoutTotalMs: 60_000,
      steps: [
        {
          id: "s1",
          label: "step",
          timeoutMs: 10_000,
          retries: 2,
          run: async () => {
            n++;
            if (n < 2) {
              throw new Error("no");
            }
          },
        },
      ],
    });

    expect(ok).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.attempts).toBe(2);
  });

  test("skip", async () => {
    const { ok, results } = await runSteps({
      runId: "test",
      config: {},
      timeoutTotalMs: 60_000,
      steps: [
        {
          id: "s1",
          label: "step",
          timeoutMs: 10_000,
          skip: () => "because",
          run: async () => {
            throw new Error("should_not_run");
          },
        },
      ],
    });

    expect(ok).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]?.skipped).toBe(true);
    expect(results[0]?.attempts).toBe(0);
  });

  test("cleanup defers run in reverse", async () => {
    const calls: string[] = [];
    const { ok } = await runSteps({
      runId: "test",
      config: {},
      timeoutTotalMs: 60_000,
      steps: [
        {
          id: "s1",
          label: "step1",
          timeoutMs: 10_000,
          run: async (ctx) => {
            ctx.defer(() => {
              calls.push("a");
            });
          },
        },
        {
          id: "s2",
          label: "step2",
          timeoutMs: 10_000,
          run: async (ctx) => {
            ctx.defer(() => {
              calls.push("b");
            });
          },
        },
      ],
    });

    expect(ok).toBe(true);
    expect(calls).toEqual(["b", "a"]);
  });
});
