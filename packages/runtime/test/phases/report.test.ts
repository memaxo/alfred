import { describe, expect, it } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../../src/context";
import type { RuntimeInput } from "../../src/types";
import { executeReportPhase } from "../../src/phases/report";

const input: RuntimeInput = {
  requirement: "Summarize work",
  auto: "low",
};

const scanContext: ExecutionContext = {
  requirement: input.requirement,
  receipts: { code: [], created: new Date() },
  bundle: {
    maxTokens: 1000,
    estimatedTokens: 200,
    files: [],
  },
  totalTokens: 200,
};

describe("executeReportPhase", () => {
  it("emits report summary with metrics", async () => {
    const artifacts = {
      events: [
        { type: "notice", message: "start" } as WorkflowEvent,
        { type: "tool-call", toolName: "echo", toolCallId: "1" } as any,
        { type: "tool-result", toolName: "echo", toolCallId: "1" } as any,
        { type: "error", message: "boom" } as WorkflowEvent,
      ],
      planSummary: "Plan summary",
      scanContext,
      startedAt: Date.now() - 1000,
    };

    const generator = executeReportPhase(
      input,
      new AbortController().signal,
      artifacts
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const reportEvent = events.find((event) => event.type === "report");
    expect(reportEvent).toBeDefined();
    const summary = (reportEvent as any).summary;
    expect(summary.requirement).toBe(input.requirement);
    expect(summary.tools.calls).toBe(1);
    expect(summary.tools.results).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.context.files).toBe(0);
    expect(summary.planSummary).toBe("Plan summary");
    expect(events.at(-1)).toMatchObject({
      type: "notice",
      message: "reporting_completed",
    });
  });

  it("throws when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const generator = executeReportPhase(
      input,
      controller.signal,
      { events: [] }
    );

    const first = await generator.next();
    expect(first.value).toMatchObject({
      type: "notice",
      message: "reporting_started",
    });
    await expect(generator.next()).rejects.toBeInstanceOf(DOMException);
  });
});
