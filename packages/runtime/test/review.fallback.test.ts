import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke";
import { runReviewPhase } from "../src/orchestrator/review";
import type { OrchestratorContext } from "../src/orchestrator/types";
import {
  cleanupPlanDir,
  mockRunner,
  preparePlanDir,
} from "./utils/review-helpers";

describe("review fallback integration", () => {
  let restoreRunner: (() => void) | undefined;
  let restoreCodex: (() => void) | undefined;
  let originalSmoke: typeof smokeTester.verify;

  beforeEach(() => {
    process.env.ORCH_TMUX_DISABLED = "1";
    originalSmoke = smokeTester.verify;
  });

  afterEach(async () => {
    delete process.env.ORCH_TMUX_DISABLED;
    restoreRunner?.();
    restoreRunner = undefined;
    restoreCodex?.();
    restoreCodex = undefined;
    smokeTester.verify = originalSmoke;
  });

  it("creates debugger plan and emits fallback events", async () => {
    const runId = `review-run-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    const commands: string[] = [];
    restoreRunner = mockRunner(async ({ command }) => {
      commands.push(command);
      return {
        stdout: "fail",
        stderr: "stack trace",
        exitCode: 1,
        durationMs: 5,
      };
    });

    const originalCodex = toolCodex.execute;
    toolCodex.execute = async () => {};
    restoreCodex = () => {
      toolCodex.execute = originalCodex;
    };

    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Investigate failing tests",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "changes staged",
      expectedFiles: ["packages/agent/src/foo.ts"],
      changedPackages: ["packages/agent", "apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    const events: any[] = [];
    let reviewContent = "";
    let debuggerContent = "";
    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const event of generator) {
        events.push(event);
      }

      const reviewPlanPath = path.join(".agent", "plans", runId, "review.md");
      const debuggerPlanPath = path.join(
        ".agent",
        "plans",
        runId,
        "review-debugger.md"
      );
      reviewContent = await fs.readFile(reviewPlanPath, "utf8");
      debuggerContent = await fs.readFile(debuggerPlanPath, "utf8");
    } finally {
      await cleanupPlanDir(runId);
    }

    const expectedCommands = [
      "bun test packages/agent apps/web",
      "bun run lint",
      "bun run typecheck",
      "bun scripts/verify-orchestrator.ts",
      "bun scripts/verify-resilience.ts",
    ];
    const uniqueCommands = Array.from(new Set(commands));
    expect(uniqueCommands).toEqual(expectedCommands);
    expect(commands.length).toBeGreaterThanOrEqual(expectedCommands.length);

    expect(reviewContent).toContain("Escalated to debugger plan");
    expect(debuggerContent).toContain("Failure 1 (tests)");

    expect(
      events.some((event) => event?.message === "review_fallback_triggered")
    ).toBe(true);
    expect(events.some((event) => event?.kind === "review-fallback")).toBe(
      true
    );
  });
});
