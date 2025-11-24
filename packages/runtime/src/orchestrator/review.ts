import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  buildReviewPlan,
  generateReviewExecPlanSkeleton,
} from "@alfred/agent/orchestrator/multi/review";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke"; // Import smoke test
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { OrchestratorContext } from "./types";

const REVIEW_PLAN_FILE = (runId: string) => `.agent/plans/${runId}/review.md`;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureReviewExecPlan(
  runId: string,
  reviewPlan: ReturnType<typeof buildReviewPlan>
): Promise<string> {
  const execPlanPath = REVIEW_PLAN_FILE(runId);
  const dir = path.dirname(execPlanPath);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(execPlanPath);
  } catch {
    const skeleton = generateReviewExecPlanSkeleton(runId, reviewPlan);
    await fs.writeFile(execPlanPath, skeleton, "utf8");
  }
  return execPlanPath;
}

async function updateReviewProgress(
  filePath: string,
  checkId: string,
  status: "running" | "passed" | "failed",
  note: string
) {
  const content = await fs.readFile(filePath, "utf8");
  const pattern = new RegExp(`- \\[[ x]\\] \\[${escapeRegExp(checkId)}\\].*`);
  const stamp = new Date().toISOString();
  const label =
    status === "passed"
      ? "PASS"
      : status === "failed"
        ? "FAIL"
        : "RUNNING";
  const mark = status === "passed" ? "x" : " ";
  const replacement = `- [${mark}] [${checkId}] ${label} (${stamp}) ${note}`.trim();

  let updated = content;
  if (pattern.test(content)) {
    updated = content.replace(pattern, replacement);
  } else {
    updated = content.replace(
      /## Progress\s+/, 
      `## Progress\n\n${replacement}\n\n`
    );
  }

  await fs.writeFile(filePath, updated, "utf8");
}

async function appendReviewOutcome(
  filePath: string,
  message: string
) {
  const content = await fs.readFile(filePath, "utf8");
  const marker = "## Outcomes & Retrospective";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return;
  }
  const before = content.slice(0, idx + marker.length);
  const after = content.slice(idx + marker.length);
  const entry = `\n\n- ${message}\n`;
  await fs.writeFile(before + entry + after, "utf8");
}

async function appendReviewDecision(filePath: string, entry: string) {
  const content = await fs.readFile(filePath, "utf8");
  const marker = "## Decision Log";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return;
  }
  const before = content.slice(0, idx + marker.length);
  const after = content.slice(idx + marker.length);
  const logEntry = `\n\n- ${entry}\n`;
  await fs.writeFile(before + logEntry + after, "utf8");
}

async function createDebuggerExecPlan(
  runId: string,
  failures: Array<{ command: string; output: string; error?: string; checkId?: string }>,
  attempts: number
) {
  const filePath = `.agent/plans/${runId}/review-debugger.md`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const failureBlocks = failures.length
    ? failures
        .map((f, index) =>
          [
            `### Failure ${index + 1} (${f.checkId ?? "unknown"})`,
            `Command: ${f.command}`,
            "",
            "```",
            f.output || f.error || "<no output>",
            "```",
          ].join("\n")
        )
        .join("\n\n")
    : "No command details were captured.";

  const lines = [
    `# Review Debugger Plan for run ${runId}`,
    "",
    `Attempts exhausted: ${attempts}`,
    "",
    "## Context",
    "The automated fixer exhausted its retries. Use this plan to continue investigation manually or with a debugger agent.",
    "",
    "## Failed Checks",
    failureBlocks,
    "",
    "## Next Actions",
    "- Re-run the failing commands locally (bun run lint/test, etc.) to reproduce the error.",
    "- If a long-running process is required, start it via the session tool (session.start/peek/send/stop).",
    "- Document findings in this file's Decision Log and update review.md once resolved.",
  ];

  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  return filePath;
}

function buildTestCommandFromPlan(mergePlan: any): string {
  const changed = Array.isArray(mergePlan?.changedPackages)
    ? (mergePlan.changedPackages as string[])
    : [];
  const scoped = Array.from(
    new Set(
      changed.filter(
        (pkg) => pkg.startsWith("packages/") || pkg.startsWith("apps/")
      )
    )
  );
  if (scoped.length === 0) {
    return "bun test";
  }
  return `bun test ${scoped.join(" ")}`;
}

export async function* runReviewPhase(
  ctx: OrchestratorContext,
  mergePlan: any
): AsyncGenerator<WorkflowEvent, void, void> {
  const { input, runId, workspace, projectConfig } = ctx; // Destructure projectConfig

  const reviewPlan = buildReviewPlan({
    files: mergePlan.expectedFiles ?? [],
    summary: mergePlan.summary,
  });

  const reviewExecPlanPath = await ensureReviewExecPlan(runId, reviewPlan);

  logger.info("multi_agent_review_plan", {
    runId,
    // @ts-expect-error - ReviewPlan typing mismatch in runtime
    files: reviewPlan.files ?? [],
    // @ts-expect-error - ReviewCheck typing mismatch in runtime
    checks: reviewPlan.checks?.map((c) => c.kind) ?? [],
  });

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
      checkId?: string;
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

        const attemptIndex = fixAttempts + 1;
        yield {
          type: "event",
          kind: "review-check",
          data: {
            id: check.id,
            type: check.type,
            status: "running",
            attempt: attemptIndex,
          },
        } as any;

        let command = "";
        if (check.type === "static") {
          command = "bun run typecheck";
        } else if (check.type === "lint") {
          command = "bun run lint";
        } else if (check.type === "tests") {
          command = buildTestCommandFromPlan(mergePlan);
        } else if (check.type === "verify" && check.script) {
          command = `bun ${check.script}`;
        } else if (check.type === "smoke" && projectConfig) {
          // Phase 5: Ephemeral Verification (Smoke)
          yield { type: "notice", message: "running_smoke_test" } as any;
          await updateReviewProgress(
            reviewExecPlanPath,
            check.id,
            "running",
            "smoke-test"
          );
          const result = await smokeTester.verify(workspace, projectConfig);
          if (!result.success) {
            currentRunPassed = false;
            reviewFailures.push({
              command: "smoke-test",
              output: result.message,
              checkId: check.id,
            });
            await updateReviewProgress(
              reviewExecPlanPath,
              check.id,
              "failed",
              result.message
            );
            yield {
              type: "event",
              kind: "review-check",
              data: {
                id: check.id,
                type: check.type,
                status: "failed",
                attempt: attemptIndex,
                evidence: result.message,
              },
            } as any;
          } else {
            yield {
              type: "event",
              kind: "review-check",
              data: {
                id: check.id,
                type: check.type,
                status: "passed",
                attempt: attemptIndex,
              },
            } as any;
          }
          continue; // Skip standard runner
        } else {
          continue; // Skip manual/scenario checks for automated runner
        }

        await updateReviewProgress(
          reviewExecPlanPath,
          check.id,
          "running",
          command
        );

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
              checkId: check.id,
            });
            logger.warn("review_check_failed", {
              runId,
              command,
              exitCode: result.exitCode,
            });
            await updateReviewProgress(
              reviewExecPlanPath,
              check.id,
              "failed",
              `exit ${result.exitCode}`
            );
            yield {
              type: "event",
              kind: "review-check",
              data: {
                id: check.id,
                type: check.type,
                status: "failed",
                attempt: attemptIndex,
                evidence: `${result.stdout}\n${result.stderr}`.slice(0, 1000),
              },
            } as any;
          } else {
            await updateReviewProgress(
              reviewExecPlanPath,
              check.id,
              "passed",
              command
            );
            yield {
              type: "event",
              kind: "review-check",
              data: {
                id: check.id,
                type: check.type,
                status: "passed",
                attempt: attemptIndex,
                durationMs: result.durationMs,
              },
            } as any;
          }
        } catch (err) {
          currentRunPassed = false;
          reviewFailures.push({
            command,
            output: "",
            error: String(err),
            checkId: check.id,
          });
          logger.error("review_command_error", {
            runId,
            command,
            error: String(err),
          });
          await updateReviewProgress(
            reviewExecPlanPath,
            check.id,
            "failed",
            String(err)
          );
          yield {
            type: "event",
            kind: "review-check",
            data: {
              id: check.id,
              type: check.type,
              status: "failed",
              attempt: attemptIndex,
              evidence: String(err),
            },
          } as any;
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
                `Check: ${f.checkId ?? "unknown"}\nCommand: ${
                  f.command
                }\nError/Output:\n\`\`\`\n${
                  f.output || f.error || "<no output captured>"
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
            "- Use the 'session' tool if you need a persistent dev server (session.start/peek/send/stop).",
            "",
            "## Progress",
            "- [ ] (pending) Fix applied.",
          ].join("\n");

          await fs.writeFile(fixerExecPlanPath, skeleton, "utf8");

          const fixerAuto = input.auto === "read" ? "medium" : input.auto;
          const prompt = [
            "You are a Self-Correction 'Fixer' Agent.",
            `ExecPlan path: ${fixerExecPlanPath}`,
            "Your goal is to FIX the code so that the review checks pass.",
            "1. Read the error context in the plan.",
            "2. Edit the code to resolve the errors.",
            "3. Re-run the failing commands locally (bun run lint/test, etc.) to verify fixes before exiting.",
            "4. Use the 'session' tool when you need a persistent tmux session:",
            "   - session.start <session_id> <command> to launch a dev server or watcher.",
            "   - session.peek <session_id> to read output, session.send to send commands, session.stop to end it.",
            "5. Do not break existing functionality.",
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
              auto: fixerAuto,
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
    const attempts = fixAttempts + (reviewPassed ? 1 : 0);

    await appendReviewOutcome(
      reviewExecPlanPath,
      reviewPassed
        ? `Automated checks passed after ${attempts} run(s).`
        : `Automated checks failed after ${attempts} run(s).`
    );

    if (!reviewPassed) {
      const fallbackPlanPath = await createDebuggerExecPlan(
        runId,
        reviewFailures,
        attempts
      );
      await appendReviewDecision(
        reviewExecPlanPath,
        `Escalated to debugger plan (${path.basename(
          fallbackPlanPath
        )}) after ${attempts} attempt(s).`
      );

      yield {
        type: "notice",
        message: "review_fallback_triggered",
        plan: fallbackPlanPath,
      } as any;

      yield {
        type: "event",
        kind: "review-fallback",
        data: {
          plan: fallbackPlanPath,
          attempts,
        },
      } as any;
    }

    yield {
      type: "event",
      kind: "review-exec-result",
      data: {
        role: "review_exec",
        status: reviewPassed ? "completed" : "failed",
        durationSeconds,
        attempts,
      },
    } as any;
  }
}
