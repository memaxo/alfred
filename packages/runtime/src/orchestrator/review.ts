import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  buildReviewPlan,
  generateReviewExecPlanSkeleton,
} from "@alfred/agent/orchestrator/multi/review";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex";
import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";
import { runSmokeTest } from "@alfred/agent/orchestrator/verification/smoke"; // Import smoke test
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { OrchestratorContext } from "./types";

export async function* runReviewPhase(
  ctx: OrchestratorContext,
  mergePlan: any
): AsyncGenerator<WorkflowEvent, void, void> {
  const { input, runId, workspace, projectConfig } = ctx; // Destructure projectConfig

  const reviewPlan = buildReviewPlan({
    files: mergePlan.expectedFiles ?? [],
    summary: mergePlan.summary,
  });

  logger.info("multi_agent_review_plan", {
    runId,
    // @ts-expect-error - ReviewPlan typing mismatch in runtime
    files: reviewPlan.files ?? [],
    // @ts-expect-error - ReviewCheck typing mismatch in runtime
    checks: reviewPlan.checks?.map((c) => c.kind) ?? [],
  });

  yield {
    type: "event",
    kind: "review-plan",
    data: reviewPlan,
  } as any;
  const reviewExecPlanPath = `.agent/plans/${runId}/review.md`;
  try {
    const dir = path.dirname(reviewExecPlanPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(reviewExecPlanPath);
    } catch {
      const skeleton = generateReviewExecPlanSkeleton(runId, reviewPlan);
      await fs.writeFile(reviewExecPlanPath, skeleton, "utf8");
    }

    const promptLines = [
      "You are a review planning agent.",
      "",
      `ExecPlan path: ${reviewExecPlanPath}`,
      "",
      "Instructions:",
      "- Read the ExecPlan at the given path and the ReviewPlan summary.",
      "- Do NOT run tests, lint, or static analysis; only plan them.",
      "- For each check, specify the exact commands that should be run.",
      "- Update the Progress and Decision Log as you refine the plan.",
      "- Summarise the final review plan at the end.",
    ];
    const prompt = promptLines.join("\n");

    const startedAt = Date.now();

    const reviewEvents: WorkflowEvent[] = [];

    const writer = {
      write: async (chunk: unknown) => {
        const payload = chunk as { type?: string; event?: unknown };
        if (!payload || typeof payload !== "object") {
          return;
        }
        const type = (payload as any).type;
        if (type === "stdout" || type === "stderr") {
          const text = (payload as any).text ?? "";
          reviewEvents.push({
            type,
            text,
          } as any);
        } else if (type === "notice") {
          reviewEvents.push({
            type: "notice",
            message: (payload as any).message ?? "review_agent_notice",
          } as any);
        }
      },
    } as const;

    try {
      await toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          out: "text",
          auto: "read", // Enforce read-only for analysis agents
          cw: workspace,
          sessionId: `${runId}:review`,
          model: undefined,
          profile: undefined,
          context: {},
        },
        writer,
      });

      const finishedAt = Date.now();
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

      for (const ev of reviewEvents) {
        yield ev;
      }

      yield {
        type: "event",
        kind: "review-agent-result",
        data: {
          role: "review",
          status: "completed",
          durationSeconds,
        },
      } as any;
    } catch (error) {
      const finishedAt = Date.now();
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
      logger.warn("review_agent_execution_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      for (const ev of reviewEvents) {
        yield ev;
      }
      yield {
        type: "event",
        kind: "review-agent-result",
        data: {
          role: "review",
          status: "failed",
          durationSeconds,
        },
      } as any;
    }
  } catch (error) {
    logger.warn("review_agent_initialisation_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Review execution phase & Self-Correction Loop
  // If checks are planned, execute them using toolRunner
  if (reviewPlan.checks && reviewPlan.checks.length > 0) {
    const MAX_FIX_ATTEMPTS = 3;
    let fixAttempts = 0;
    let reviewPassed = false;
    let reviewFailures: Array<{
      command: string;
      output: string;
      error?: string;
    }> = [];
    const startedAt = Date.now();

    while (fixAttempts <= MAX_FIX_ATTEMPTS && !reviewPassed) {
      reviewFailures = [];
      let currentRunPassed = true;

      yield {
        type: "notice",
        message:
          fixAttempts === 0
            ? "review_execution_started"
            : "review_retry_started",
        attempt: fixAttempts + 1,
      } as any;

      for (const check of reviewPlan.checks) {
        if (!check) {
          continue;
        }

        let command = "";
        if (check.type === "static") {
          command = "bun run typecheck";
        } else if (check.type === "lint") {
          command = "bun run lint";
        } else if (check.type === "tests") {
          command = "bun test";
        } else if (check.type === "smoke" && projectConfig) {
          // Phase 5: Ephemeral Verification (Smoke)
          yield { type: "notice", message: "running_smoke_test" } as any;
          const success = await runSmokeTest(workspace, projectConfig);
          if (!success) {
            currentRunPassed = false;
            reviewFailures.push({
              command: "smoke-test",
              output: "Build/Smoke verification failed",
            });
          }
          continue; // Skip standard runner
        } else {
          continue; // Skip manual/scenario checks for automated runner
        }

        try {
          yield {
            type: "event",
            kind: "tool-call",
            data: { tool: "runner", command },
          } as any;

          const result = await toolRunner.execute(
            command,
            workspace,
            60_000,
            projectConfig ?? undefined
          ); // Pass projectConfig

          yield {
            type: "event",
            kind: "tool-result",
            data: {
              tool: "runner",
              command,
              exitCode: result.exitCode,
              stdout: result.stdout.slice(0, 1000), // Truncate for event stream
              durationMs: result.durationMs,
            },
          } as any;

          if (result.exitCode !== 0) {
            currentRunPassed = false;
            reviewFailures.push({
              command,
              output: `${result.stdout}\n${result.stderr}`.slice(0, 5000),
            });
            logger.warn("review_check_failed", {
              runId,
              command,
              exitCode: result.exitCode,
            });
          }
        } catch (err) {
          currentRunPassed = false;
          reviewFailures.push({
            command,
            output: "",
            error: String(err),
          });
          logger.error("review_command_error", {
            runId,
            command,
            error: String(err),
          });
        }
      }

      if (currentRunPassed) {
        reviewPassed = true;
        break;
      }

      // Self-correction: Spawn Fixer Agent if failed and retries allowed
      if (
        fixAttempts < MAX_FIX_ATTEMPTS &&
        (input.auto === "medium" || input.auto === "high")
      ) {
        yield { type: "notice", message: "self_correction_started" } as any;

        const fixerExecPlanPath = `.agent/plans/${runId}/fixer-${
          fixAttempts + 1
        }.md`;

        try {
          const dir = path.dirname(fixerExecPlanPath);
          await fs.mkdir(dir, { recursive: true });

          const failureDetails = reviewFailures
            .map(
              (f) =>
                `Command: ${f.command}\nError/Output:\n\`\`\`\n${
                  f.output || f.error
                }\n\`\`\``
            )
            .join("\n\n");

          const skeleton = [
            `# Fixer ExecPlan (Attempt ${fixAttempts + 1})`,
            "",
            "## Purpose",
            "Fix the errors detected during the review phase.",
            "",
            "## Context",
            "The following checks failed:",
            failureDetails,
            "",
            "## Plan",
            "- Analyze the error output.",
            "- Locate the source files causing the error.",
            "- Apply fixes.",
            "- Verify the fix (the review phase will re-run automatically).",
            "",
            "## Progress",
            "- [ ] (pending) Fix applied.",
          ].join("\n");

          await fs.writeFile(fixerExecPlanPath, skeleton, "utf8");

          const prompt = [
            "You are a Self-Correction 'Fixer' Agent.",
            `ExecPlan path: ${fixerExecPlanPath}`,
            "Your goal is to FIX the code so that the review checks pass.",
            "1. Read the error context in the plan.",
            "2. Edit the code to resolve the errors.",
            "3. Do not break existing functionality.",
          ].join("\n");

          const fixerEvents: WorkflowEvent[] = [];
          const writer = {
            write: async (chunk: unknown) => {
              const payload = chunk as { type?: string; event?: unknown };
              if (!payload || typeof payload !== "object") {
                return;
              }
              const type = (payload as any).type;
              if (type === "stdout" || type === "stderr") {
                fixerEvents.push({ type, text: (payload as any).text } as any);
              } else if (type === "notice") {
                fixerEvents.push({
                  type: "notice",
                  message: (payload as any).message,
                } as any);
              }
            },
          } as const;

          // Run the Fixer
          await toolCodex.execute({
            input: {
              action: "exec",
              prompt,
              out: "text",
              auto: input.auto, // Inherit write permissions
              cw: workspace,
              sessionId: `${runId}:fixer-${fixAttempts}`,
              model: undefined,
              profile: undefined,
              context: {},
            },
            writer,
          });

          for (const ev of fixerEvents) {
            yield ev;
          }

          yield {
            type: "event",
            kind: "fixer-agent-result",
            data: {
              attempt: fixAttempts + 1,
              status: "completed",
            },
          } as any;
        } catch (error) {
          logger.error("fixer_agent_failed", { error: String(error) });
          // If fixer crashes, we probably can't recover, but let the loop increment and maybe retry or fail.
        }

        fixAttempts++;
      } else {
        break; // No more retries or read-only mode
      }
    }

    const finishedAt = Date.now();
    const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

    yield {
      type: "event",
      kind: "review-exec-result",
      data: {
        role: "review_exec",
        status: reviewPassed ? "completed" : "failed",
        durationSeconds,
        attempts: fixAttempts + (reviewPassed ? 1 : 0), // Count the successful run if passed
      },
    } as any;
  }
}
