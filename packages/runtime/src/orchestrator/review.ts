import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
import {
  buildReviewPlan,
  formatReviewFailureDetails,
  generateFixerExecPlanSkeleton,
  generateReviewExecPlanSkeleton,
  type ReviewFailureDetail,
} from "@alfred/agent/orchestrator/multi/review";
import { buildFixerAgentSpec } from "@alfred/agent/orchestrator/multi/spawn";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke"; // Import smoke test
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { formatCodexRuntimeError } from "../utils/codex-error";
import type { OrchestratorContext } from "./types";

const REVIEW_PLAN_FILE = (runId: string) => `.agent/plans/${runId}/review.md`;
function reviewSessionsEnabled() {
  return (
    process.env.ORCH_REVIEW_SESSIONS === "1" ||
    process.env.ORCH_ENABLE_SESSIONS === "1"
  );
}
const REVIEW_FIXER_SESSION_COMMAND =
  process.env.ORCH_FIXER_SESSION_COMMAND?.trim() ||
  process.env.ORCH_REVIEW_SESSION_COMMAND?.trim() ||
  "bash";

type SessionController = {
  start(attempt: number): Promise<string | null>;
  stop(sessionId: string | null): Promise<void>;
  cleanup(): Promise<void>;
};

type ReviewWorkflowRepo = {
  getRun: typeof workflowRepo.getRun;
  updateRun: typeof workflowRepo.updateRun;
};

// Mutable indirection so tests can patch without relying on module mock order.
export const reviewWorkflowRepo: ReviewWorkflowRepo = {
  getRun: workflowRepo.getRun,
  updateRun: workflowRepo.updateRun,
};

function createSessionController(
  runId: string,
  repoBase: string
): SessionController {
  let workspacePromise: Promise<Workspace | null> | null = null;

  const ensureWorkspace = async () => {
    if (!workspacePromise) {
      workspacePromise = WorkspaceFactory.create(
        "worktree",
        `review-${runId}`,
        runId,
        repoBase,
        { enableSessions: true }
      ).catch((error) => {
        logger.warn("review_session_workspace_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
    }
    return workspacePromise;
  };

  return {
    async start(attempt: number) {
      const workspace = await ensureWorkspace();
      if (!workspace?.startSession) {
        return null;
      }
      const name = `ws-${runId}-fixer-${attempt}`;
      try {
        return await workspace.startSession(REVIEW_FIXER_SESSION_COMMAND, name);
      } catch (error) {
        logger.warn("review_session_start_failed", {
          runId,
          sessionId: name,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    async stop(sessionId: string | null) {
      if (!sessionId) {
        return;
      }
      const workspace = await ensureWorkspace();
      if (!workspace?.stopSession) {
        return;
      }
      try {
        await workspace.stopSession(sessionId);
      } catch (error) {
        logger.warn("review_session_stop_failed", {
          runId,
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    async cleanup() {
      const workspace = await workspacePromise;
      if (!workspace?.cleanup) {
        return;
      }
      try {
        await workspace.cleanup();
      } catch (error) {
        logger.warn("review_session_cleanup_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  } satisfies SessionController;
}

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
    status === "passed" ? "PASS" : status === "failed" ? "FAIL" : "RUNNING";
  const mark = status === "passed" ? "x" : " ";
  const replacement =
    `- [${mark}] [${checkId}] ${label} (${stamp}) ${note}`.trim();

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

async function appendReviewOutcome(filePath: string, message: string) {
  const content = await fs.readFile(filePath, "utf8");
  const marker = "## Outcomes & Retrospective";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return;
  }
  const before = content.slice(0, idx + marker.length);
  const after = content.slice(idx + marker.length);
  const entry = `\n\n- ${message}\n`;
  await fs.writeFile(filePath, before + entry + after, "utf8");
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
  await fs.writeFile(filePath, before + logEntry + after, "utf8");
}

async function createDebuggerExecPlan(
  runId: string,
  failures: Array<{
    command: string;
    output: string;
    error?: string;
    checkId?: string;
  }>,
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
  const { input, runId, workspace, projectConfig, authz, signal, userId } = ctx; // Destructure projectConfig

  const reviewPlan = buildReviewPlan({
    files: mergePlan.expectedFiles ?? [],
    summary: mergePlan.summary,
  });

  const reviewFocusFiles = Array.isArray(mergePlan?.expectedFiles)
    ? Array.from(
        new Set(
          (mergePlan.expectedFiles as string[]).filter(
            (file): file is string =>
              typeof file === "string" && file.length > 0
          )
        )
      ).slice(0, 50)
    : [];

  const sessionController = reviewSessionsEnabled()
    ? createSessionController(runId, workspace)
    : null;

  if (
    (!reviewPlan.checks || reviewPlan.checks.length === 0) &&
    ctx.input.linear?.sessionId
  ) {
    reviewPlan.checks = [
      {
        id: "linear-default-tests",
        // historically some runtime callsites/tests used `type`.
        type: "tests",
        description:
          "Run the project's test suite (bun test) to validate the Linear-directed workflow.",
      } as any,
    ];
  }

  const reviewExecPlanPath = await ensureReviewExecPlan(runId, reviewPlan);

  logger.info("multi_agent_review_plan", {
    runId,
    // @ts-expect-error - ReviewPlan typing mismatch in runtime
    files: reviewPlan.files ?? [],
    // @ts-expect-error - ReviewCheck typing mismatch in runtime
    checks: reviewPlan.checks?.map((c) => c.kind) ?? [],
  });

  try {
    // Review execution phase & Self-Correction Loop
    // If checks are planned, execute them using toolRunner
    if (reviewPlan.checks && reviewPlan.checks.length > 0) {
      const MAX_FIX_ATTEMPTS = 3;

      // Load persisted fixAttempts from workflow stateData
      let fixAttempts = 0;
      try {
        const workflowRun = await reviewWorkflowRepo.getRun(runId);
        if (
          workflowRun?.stateData &&
          typeof workflowRun.stateData === "object"
        ) {
          const stateData = workflowRun.stateData as Record<string, unknown>;
          if (typeof stateData.fixAttempts === "number") {
            fixAttempts = stateData.fixAttempts;
          }
        }
      } catch (error) {
        logger.warn("failed_to_load_fix_attempts", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Default to 0 if load fails
      }
      let reviewPassed = false;
      let reviewFailures: ReviewFailureDetail[] = [];
      const startedAt = Date.now();

      while (fixAttempts < MAX_FIX_ATTEMPTS && !reviewPassed) {
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

          // Contract: checks may be shaped as `{ kind: "tests" }` (agent),
          // while older runtime/test code used `{ type: "tests" }`.
          const checkType = (check as any).type ?? (check as any).kind;
          if (typeof checkType !== "string" || checkType.length === 0) {
            continue;
          }

          const attemptIndex = fixAttempts + 1;
          yield {
            type: "event",
            kind: "review-check",
            data: {
              id: check.id,
              type: checkType,
              status: "running",
              attempt: attemptIndex,
            },
          } as any;

          let command = "";
          if (checkType === "static") {
            command = "bun run typecheck";
          } else if (checkType === "lint") {
            command = "bun run lint";
          } else if (checkType === "tests") {
            command = buildTestCommandFromPlan(mergePlan);
          } else if (checkType === "verify" && (check as any).script) {
            command = `bun ${check.script}`;
          } else if (checkType === "smoke" && projectConfig) {
            // Phase 5: Ephemeral Verification (Smoke)
            yield { type: "notice", message: "running_smoke_test" } as any;
            await updateReviewProgress(
              reviewExecPlanPath,
              check.id,
              "running",
              "smoke-test"
            );
            const result = await smokeTester.verify(workspace, projectConfig);
            if (result.success) {
              yield {
                type: "event",
                kind: "review-check",
                data: {
                  id: check.id,
                  type: checkType,
                  status: "passed",
                  attempt: attemptIndex,
                },
              } as any;
            } else {
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
                  type: checkType,
                  status: "failed",
                  attempt: attemptIndex,
                  evidence: result.message,
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
                  type: checkType,
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
                  type: checkType,
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
                type: checkType,
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

          try {
            const fixerSpec = buildFixerAgentSpec({
              runId,
              cwd: workspace,
              attempt: fixAttempts + 1,
              summary: reviewPlan.summary,
              relevantFiles: reviewFocusFiles,
              auto: input.auto,
              linear: input.linear
                ? {
                    issueId: undefined,
                    sessionId: input.linear.sessionId,
                    space: input.linear.space,
                    authz: input.linear.authz,
                  }
                : undefined,
            });

            const fixerExecPlanPath = path.resolve(
              workspace,
              fixerSpec.execPlanPath
            );
            await fs.mkdir(path.dirname(fixerExecPlanPath), {
              recursive: true,
            });

            const fixerPlan = generateFixerExecPlanSkeleton({
              runId,
              attempt: fixAttempts + 1,
              failures: reviewFailures,
              relevantFiles: reviewFocusFiles,
            });
            await fs.writeFile(fixerExecPlanPath, fixerPlan, "utf8");

            const promptLines = [
              "You are a Self-Correction 'Fixer' Agent.",
              `ExecPlan path: ${fixerSpec.execPlanPath}`,
              "Your goal is to FIX the code so that the review checks pass.",
              "1. Read the error context in the plan.",
              "2. Edit the code to resolve the errors.",
              "3. Re-run the failing commands locally (bun run lint/test, etc.) to verify fixes before exiting.",
              "4. Use the 'session' tool when you need a persistent tmux session:",
              "   - session.start <session_id> <command> to launch a dev server or watcher.",
              "   - session.peek <session_id> to read output, session.send to send commands, session.stop to end it.",
              "5. Do not break existing functionality.",
            ];

            if (fixerSpec.context.relevantFiles?.length) {
              promptLines.push("", "Relevant files to inspect:");
              for (const file of fixerSpec.context.relevantFiles.slice(0, 10)) {
                promptLines.push(`- ${file}`);
              }
            }

            const failureDetails = formatReviewFailureDetails(reviewFailures);
            if (failureDetails.trim().length > 0) {
              promptLines.push("", "Failure details:", failureDetails);
            }

            const prompt = promptLines.join("\n");

            const fixerEvents: WorkflowEvent[] = [];
            const writer = {
              write: async (chunk: unknown) => {
                const payload = chunk as { type?: string; event?: unknown };
                if (!payload || typeof payload !== "object") {
                  return;
                }
                const type = (payload as any).type;
                if (type === "stdout" || type === "stderr") {
                  fixerEvents.push({
                    type,
                    text: (payload as any).text,
                  } as any);
                } else if (type === "notice") {
                  fixerEvents.push({
                    type: "notice",
                    message: (payload as any).message,
                  } as any);
                }
              },
            } as const;

            let fixerSessionId: string | null = null;
            try {
              if (sessionController) {
                fixerSessionId = await sessionController.start(fixAttempts + 1);
              }

              await toolCodex.execute({
                input: {
                  action: "exec",
                  prompt,
                  out: "text",
                  auto: fixerSpec.auto,
                  cw: fixerSpec.workingDirectory,
                  sessionId: fixerSpec.sessionId,
                  model: fixerSpec.model,
                  profile: fixerSpec.profile,
                  authz,
                  context: {
                    linearSessionId: fixerSpec.context.linearSessionId,
                    linearSpace: fixerSpec.context.linearSpace,
                    linearAuthz: fixerSpec.context.linearAuthz,
                    linearIssueId: fixerSpec.context.linearIssueId,
                    relevantFiles: fixerSpec.context.relevantFiles,
                  },
                  userId,
                },
                writer,
                signal,
              });
            } finally {
              await sessionController?.stop(fixerSessionId);
            }

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
            const {
              userMessage,
              rawMessage,
              code,
              needsElevation,
              limitExceeded,
            } = formatCodexRuntimeError(error);
            logger.error("fixer_agent_failed", {
              error: rawMessage,
              code,
              needsElevation,
              limitExceeded,
            });
            yield { type: "notice", message: userMessage } as any;
            // If fixer crashes, we probably can't recover, but let the loop increment and maybe retry or fail.
          }

          fixAttempts++;

          // Persist fixAttempts to workflow stateData
          try {
            const workflowRun = await reviewWorkflowRepo.getRun(runId);
            const existingStateData =
              workflowRun?.stateData &&
              typeof workflowRun.stateData === "object"
                ? (workflowRun.stateData as Record<string, unknown>)
                : {};
            await reviewWorkflowRepo.updateRun(runId, {
              stateData: {
                ...existingStateData,
                fixAttempts,
                lastFixAttemptAt: Date.now(),
              },
            });
          } catch (error) {
            logger.warn("failed_to_persist_fix_attempts", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue even if persistence fails
          }
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
          reviewFailures.map((f) => ({
            command: f.command ?? "unknown",
            output: f.output ?? "",
            error: f.error,
            checkId: f.checkId,
          })),
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

        yield {
          type: "event",
          kind: "review-escalated",
          data: {
            reason: "fixer_exhausted",
            attempts,
            fixerAttempts: fixAttempts,
            plan: fallbackPlanPath,
            failures: reviewFailures,
            relevantFiles: reviewFocusFiles,
            summary: formatReviewFailureDetails(reviewFailures),
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
  } finally {
    await sessionController?.cleanup();
  }
}
