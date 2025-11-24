import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { runReviewPhase } from "../src/orchestrator/review";
import type { OrchestratorContext } from "../src/orchestrator/types";

const runId = `review-run-${Date.now()}`;
const planDir = path.join(".agent", "plans", runId);

const runnerModule = await import("@alfred/agent/orchestrator/tool/runner");
const mockRunnerExecute = mock(async () => ({
  stdout: "fail",
  stderr: "stack trace",
  exitCode: 1,
  durationMs: 10,
}));

runnerModule.toolRunner.execute = mockRunnerExecute as any;

const codexModule = await import("@alfred/agent/orchestrator/tool/codex/index");
codexModule.toolCodex.execute = mock(async () => undefined) as any;

const smokeModule = await import(
  "@alfred/agent/orchestrator/verification/smoke"
);
smokeModule.smokeTester.verify = mock(async () => ({
  success: true,
  message: "ok",
}));

describe("runReviewPhase fallback", () => {
  beforeEach(async () => {
    mockRunnerExecute.mockClear();
    await fs.rm(planDir, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(async () => {
    await fs.rm(planDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates debugger ExecPlan when retries are exhausted", async () => {
    const ctx = {
      input: {
        requirement: "test",
        auto: "read",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } satisfies Partial<OrchestratorContext> as OrchestratorContext;

    const mergePlan = {
      summary: "Test merge summary",
      expectedFiles: ["packages/agent/src/example.ts"],
    };

    const reviewEvents: any[] = [];
    const generator = runReviewPhase(ctx, mergePlan);
    for await (const event of generator) {
      reviewEvents.push(event);
    }

    const debuggerPlan = path.join(planDir, "review-debugger.md");
    const reviewPlan = path.join(planDir, "review.md");

    const debuggerContents = await fs.readFile(debuggerPlan, "utf8");
    expect(debuggerContents).toContain("Review Debugger Plan");
    expect(debuggerContents).toContain("Failure 1 (tests)");

    const reviewContents = await fs.readFile(reviewPlan, "utf8");
    expect(reviewContents).toContain("Escalated to debugger plan");

    expect(
      reviewEvents.some(
        (ev) => ev?.message === "review_fallback_triggered"
      )
    ).toBe(true);
  });
});
