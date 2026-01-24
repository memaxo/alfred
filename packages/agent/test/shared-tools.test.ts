import { describe, expect, it, vi } from "bun:test";

import {
  appendReasoningTrace,
  createReasoningAccumulator,
} from "../src/orchestrator/tool/shared/reasoning";
import { createTimeout } from "../src/orchestrator/tool/shared/subprocess";

describe("shared reasoning helpers", () => {
  it("truncates multi-byte reasoning at UTF-8 boundaries", () => {
    const acc = createReasoningAccumulator();
    const text = "😀😀plan"; // two emoji (4 bytes each) plus ascii

    appendReasoningTrace(acc, text, 123, 5);

    expect(acc.traces).toHaveLength(1);
    expect(acc.traces[0]).toMatchObject({
      text: "😀",
      timestamp: 123,
    });
    expect(acc.truncated).toBe(true);
    expect(acc.storedBytes).toBe(Buffer.from("😀").byteLength);
  });

  it("marks accumulator as truncated when no character fits within remaining bytes", () => {
    const acc = createReasoningAccumulator();

    appendReasoningTrace(acc, "😀", undefined, 2);

    expect(acc.traces).toHaveLength(0);
    expect(acc.truncated).toBe(true);
    expect(acc.storedBytes).toBe(2);
  });
});

describe("shared subprocess helpers", () => {
  it("kills the process and notifies writer on timeout", async () => {
    const kill = vi.fn();
    const write = vi.fn();

    const ctx = createTimeout(
      { kill },
      0.001,
      { write },
      "codex_exec_timeout_test"
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(kill).toHaveBeenCalledWith("SIGKILL");
    expect(write).toHaveBeenCalledWith({
      type: "notice",
      message: "codex_exec_timeout_test",
    });
    expect(ctx.didTimeout).toBe(true);

    ctx.clear();
  });
});
