import type { WorkflowEvent } from "@alfred/type/plan";

import { tool } from "ai";
import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { executeToolGraph, type ToolGraph } from "../src/chain";

async function drain<T>(
  generator: AsyncGenerator<WorkflowEvent, T, void>
): Promise<{ events: WorkflowEvent[]; result: T }> {
  const events: WorkflowEvent[] = [];
  const iter = generator[Symbol.asyncIterator]();
  let result!: T;
  while (true) {
    const next = await iter.next();
    if (next.done) {
      result = next.value;
      break;
    }
    events.push(next.value);
  }
  return { events, result };
}

function createBarrier(count: number, timeoutMs: number) {
  const arrived = new Set<string>();
  let resolveReady: (() => void) | undefined;
  let rejectReady: ((error: Error) => void) | undefined;

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const timeout = setTimeout(() => {
    rejectReady?.(new Error("barrier_timeout"));
  }, timeoutMs);

  return {
    arrived,
    async arrive(name: string) {
      arrived.add(name);
      if (arrived.size === count) {
        clearTimeout(timeout);
        resolveReady?.();
      }
      await ready;
    },
  };
}

describe("executeToolGraph", () => {
  it("passes tool outputs via $ref and infers dependencies", async () => {
    const tools = {
      produce: tool({
        description: "Return { n }",
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ n: z.number() }),
        async execute(input) {
          return { n: input.n };
        },
      }),
      consume: tool({
        description: "Return { doubled }",
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
        async execute(input) {
          return { doubled: input.n * 2 };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        { id: "node-a", toolName: "produce", input: { n: 2 } },
        {
          id: "node-b",
          toolName: "consume",
          input: { n: { $ref: { step: "node-a", path: "n" } } },
        },
      ],
    };

    const { events, result } = await drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
        makeToolCallId: () => "call",
      })
    );

    expect(result.status).toBe("succeeded");
    expect(result.outputs["node-b"]).toEqual({ doubled: 4 });

    const consumeCall = events.find(
      (event) => event._ === "tool-call" && event.toolName === "consume"
    );
    expect(consumeCall).toBeDefined();
    expect(
      (consumeCall as Extract<WorkflowEvent, { _: "tool-call" }>).input
    ).toEqual({ n: 2 });
  });

  it("does not execute nodes until explicit dependsOn deps succeed", async () => {
    let gateFinished = false;
    let gateRelease: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      gateRelease = resolve;
    });

    const tools = {
      gate: tool({
        description: "Wait until released",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          await gate;
          gateFinished = true;
          return { ok: true };
        },
      }),
      check: tool({
        description: "Assert gate finished",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          if (!gateFinished) {
            throw new Error("gate_not_finished");
          }
          return { ok: true };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        { id: "a", toolName: "gate", input: {} },
        { id: "b", toolName: "check", input: {}, dependsOn: ["a"] },
      ],
    };

    const run = drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
      })
    );

    // Let the gate tool continue
    gateRelease?.();

    const { result } = await run;
    expect(result.status).toBe("succeeded");
    expect(result.outputs["b"]).toEqual({ ok: true });
  });

  it("executes independent nodes in parallel (same wave)", async () => {
    const barrier = createBarrier(2, 250);

    const tools = {
      t1: tool({
        description: "Barrier tool 1",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          await barrier.arrive("t1");
          return { ok: true };
        },
      }),
      t2: tool({
        description: "Barrier tool 2",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          await barrier.arrive("t2");
          return { ok: true };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        { id: "a", toolName: "t1", input: {} },
        { id: "b", toolName: "t2", input: {} },
      ],
    };

    const { result } = await drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
      })
    );

    expect(result.status).toBe("succeeded");
    expect(barrier.arrived.size).toBe(2);
  });

  it("retries a node that fails once then succeeds", async () => {
    let calls = 0;
    const tools = {
      flaky: tool({
        description: "Fails once",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true), calls: z.number() }),
        async execute() {
          calls += 1;
          if (calls === 1) {
            throw new Error("boom");
          }
          return { ok: true, calls };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [{ id: "a", toolName: "flaky", input: {}, retries: 1 }],
    };

    const { events, result } = await drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
        backoffMs: 0,
      })
    );

    expect(result.status).toBe("succeeded");
    expect(result.outputs["a"]).toEqual({ ok: true, calls: 2 });
    expect(
      events.some(
        (event) =>
          event._ === "error" && event.message === "tool_execute_failed"
      )
    ).toBe(true);
  });

  it("runs fallback tool when retries are exhausted", async () => {
    const tools = {
      primary: tool({
        description: "Always fails",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          throw new Error("nope");
        },
      }),
      fallback: tool({
        description: "Always succeeds",
        inputSchema: z.object({}),
        outputSchema: z.object({
          ok: z.literal(true),
          via: z.literal("fallback"),
        }),
        async execute() {
          return { ok: true, via: "fallback" };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        {
          id: "a",
          toolName: "primary",
          input: {},
          retries: 0,
          fallback: { toolName: "fallback", input: {} },
        },
      ],
    };

    const { result } = await drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
        backoffMs: 0,
      })
    );

    expect(result.status).toBe("succeeded");
    expect(result.outputs["a"]).toEqual({ ok: true, via: "fallback" });
    expect(result.nodes["a"]).toMatchObject({
      status: "succeeded",
      usedFallback: true,
      toolName: "fallback",
    });
  });

  it("treats invalid output as failure, triggering retry and fallback", async () => {
    let calls = 0;
    const tools = {
      invalid: tool({
        description: "Returns invalid output",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          calls += 1;
          return { ok: "nope" };
        },
      }),
      fallback: tool({
        description: "Return valid output",
        inputSchema: z.object({}),
        outputSchema: z.object({
          ok: z.literal(true),
          via: z.literal("fallback"),
        }),
        async execute() {
          return { ok: true, via: "fallback" };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        {
          id: "a",
          toolName: "invalid",
          input: {},
          retries: 1,
          fallback: { toolName: "fallback", input: {} },
        },
      ],
    };

    const { events, result } = await drain(
      executeToolGraph({
        graph,
        tools,
        signal: new AbortController().signal,
        toolCallMessages: [],
        backoffMs: 0,
      })
    );

    expect(result.status).toBe("succeeded");
    expect(result.outputs["a"]).toEqual({ ok: true, via: "fallback" });
    expect(calls).toBe(2);
    expect(
      events.some(
        (event) =>
          event._ === "error" && event.message === "tool_output_invalid"
      )
    ).toBe(true);
  });

  it("stops scheduling new nodes immediately after abort", async () => {
    const controller = new AbortController();
    let bCalls = 0;
    let cCalls = 0;

    const tools = {
      aborter: tool({
        description: "Abort the run",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          controller.abort();
          return { ok: true };
        },
      }),
      b: tool({
        description: "Should not run after abort",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          bCalls += 1;
          return { ok: true };
        },
      }),
      c: tool({
        description: "Should not run after abort",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          cCalls += 1;
          return { ok: true };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: [
        { id: "a", toolName: "aborter", input: {} },
        { id: "b", toolName: "b", input: {} },
        { id: "c", toolName: "c", input: {} },
      ],
    };

    const consume = async () => {
      for await (const _ of executeToolGraph({
        graph,
        tools,
        signal: controller.signal,
        toolCallMessages: [],
        maxParallel: 1,
        backoffMs: 0,
      })) {
        // drain
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(DOMException);
    expect(bCalls).toBe(0);
    expect(cCalls).toBe(0);
  });

  it("rejects graphs that exceed the max node limit", async () => {
    const tools = {
      noop: tool({
        description: "Always succeeds",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        async execute() {
          return { ok: true };
        },
      }),
    };

    const graph: ToolGraph = {
      nodes: Array.from({ length: 33 }, (_, i) => ({
        id: `n${i}`,
        toolName: "noop",
        input: {},
      })),
    };

    await expect(
      drain(
        executeToolGraph({
          graph,
          tools,
          signal: new AbortController().signal,
          toolCallMessages: [],
          backoffMs: 0,
        })
      )
    ).rejects.toThrow(/tool_graph_too_many_nodes/);
  });
});
