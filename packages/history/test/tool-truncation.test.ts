import { createTokenEstimator } from "@alfred/metrics/token";
import { describe, expect, it } from "bun:test";

import {
  shouldTruncateToolResult,
  summarizeToolPayload,
  truncateToolPart,
} from "../src/tool-truncation";

function repeat(s: string, n: number): string {
  return Array.from({ length: n }, () => s).join("");
}

describe("tool truncation", () => {
  it("truncates oversized tool results into summary+ref shape", () => {
    const estimator = createTokenEstimator({ model: "openai/gpt-4o-mini" });
    const huge = repeat("0123456789 ", 10_000);
    const part: any = {
      type: "tool-result",
      toolCallId: "call-1",
      toolName: "core_git",
      output: huge,
    };

    expect(shouldTruncateToolResult(estimator, part, 4000)).toBe(true);

    const summaryText = summarizeToolPayload(part.output);
    const out = truncateToolPart(part, {
      ref: { kind: "agentfs_kv", runId: "run-1", key: "toolresult:call-1:sha" },
      summaryText,
    }) as any;

    expect(out.type).toBe("tool-result");
    expect(out.output).toMatchObject({
      summaryText,
      ref: { kind: "agentfs_kv", runId: "run-1", key: "toolresult:call-1:sha" },
    });
  });
});
