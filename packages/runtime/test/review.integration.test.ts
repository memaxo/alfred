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

describe("review integration happy path", () => {
  let restoreRunner: (() => void) | undefined;
  let originalCodex: typeof toolCodex.execute;
  let originalSmoke: typeof smokeTester.verify;

  beforeEach(() => {
    process.env.ORCH_TMUX_DISABLED = "1";
    originalCodex = toolCodex.execute;
    originalSmoke = smokeTester.verify;
  });

  afterEach(async () => {
    process.env.ORCH_TMUX_DISABLED = undefined;
    restoreRunner?.();
    restoreRunner = undefined;
    toolCodex.execute = originalCodex;
    smokeTester.verify = originalSmoke;
  });

  it("marks review checks as PASS and avoids fallback", async () => {
    const runId = `review-ok-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    const runnerCommands: string[] = [];
    restoreRunner = mockRunner(async ({ command }) => {
      runnerCommands.push(command);
      return {
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        durationMs: 1,
      };
    });

    toolCodex.execute = async () => {};
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Ensure review passes",
        auto: "low",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "safe",
      expectedFiles: ["apps/web/src/foo.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    const events: any[] = [];
    let reviewContent = "";
    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const event of generator) {
        events.push(event);
      }

      const reviewPlanPath = path.join(".agent", "plans", runId, "review.md");
      reviewContent = await fs.readFile(reviewPlanPath, "utf8");
    } finally {
      await cleanupPlanDir(runId);
    }

    expect(runnerCommands).toEqual([
      "bun test apps/web",
      "bun run lint",
      "bun run typecheck",
      "bun scripts/verify-build.ts",
    ]);

    expect(reviewContent).toContain("[tests] PASS");
    expect(reviewContent).toContain("[lint] PASS");
    expect(reviewContent).toContain("[static] PASS");
    expect(reviewContent).not.toContain("Escalated to debugger plan");

    expect(
      events.every((event) => event?.message !== "review_fallback_triggered")
    ).toBe(true);

    await cleanupPlanDir(runId);
  });
});
