import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { SerializableValue } from "../snapshot";
import type { ExecuteOutput, ReviewCheck, ReviewOutput } from "./types";
import type { WorkflowEvent } from "@alfred/type";

/**
 * Review Stage
 *
 * Performs quality checks on agent execution results.
 * Integrates:
 * - ReviewGate for structured check tracking
 * - Automatic fix attempts via fixer loop
 * - State serialization for resume capability
 */
export class ReviewStage implements PipelineStage<ExecuteOutput, ReviewOutput> {
  readonly name = "review" as const;

  private formatQueueEvent(event: WorkflowEvent): string {
    const payload = event as unknown as Record<string, unknown>;
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
    if (typeof payload.kind === "string" && payload.kind.length > 0) {
      return payload.kind;
    }
    if (typeof payload.type === "string" && payload.type.length > 0) {
      return payload.type;
    }
    return "agent_event";
  }

  async execute(
    input: ExecuteOutput,
    ctx: PipelineContext
  ): Promise<ReviewOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        stage: "review",
        message: "Running quality checks",
      })
    );

    // Import ReviewGate dynamically to avoid circular dependencies
    const { ReviewGate } = await import("@alfred/agent/workflow/review-gate");

    // Create and initialize ReviewGate
    const gate = new ReviewGate();

    // Restore gate state if resuming
    const savedGateState =
      ctx.get<ReturnType<typeof gate.serialize>>("reviewGateState");
    if (savedGateState) {
      gate.restore(savedGateState);
      logger.info("review_gate_restored", {
        runId: ctx.runId,
        checkCount: savedGateState.checks?.length ?? 0,
      });
    }

    // Get fix attempts from context (for resume)
    let fixAttempts = ctx.get<number>("fixAttempts") ?? 0;

    // Check Linear requirement
    const linearSessionId = ctx.get<string>("linearSessionId");
    if (linearSessionId) {
      gate.requireAtLeast(1);
    }

    try {
      // Run initial checks on agent outcomes
      await this.checkAgentOutcomes(input, gate, ctx);

      // Save gate state metadata (not full serialization)
      const gateSummary = gate.summary();
      ctx.set("reviewGateSummary", {
        totalChecks: gateSummary.length,
        passedChecks: gateSummary.filter((c) => c.status === "passed").length,
        satisfied: gate.isSatisfied(),
      });

      // Fixer loop (if enabled and gate not satisfied)
      const fixerConfig = ctx.config.reviewFixer;
      if (fixerConfig?.enabled && !gate.isSatisfied()) {
        fixAttempts = await this.runFixerLoop(input, gate, ctx, fixAttempts);
      }

      // Final gate state metadata
      const finalSummary = gate.summary();
      ctx.set("reviewGateSummary", {
        totalChecks: finalSummary.length,
        passedChecks: finalSummary.filter((c) => c.status === "passed").length,
        satisfied: gate.isSatisfied(),
      });
      ctx.set("fixAttempts", fixAttempts);

      logger.info("review_stage_complete", {
        runId: ctx.runId,
        allPassed: gate.isSatisfied(),
        fixAttempts,
        checkCount: gate.summary().length,
      });
    } catch (error) {
      logger.error("review_stage_failed", {
        runId: ctx.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Convert gate summary to ReviewCheck format
    const checks: ReviewCheck[] = gate.summary().map((check) => ({
      name: check.id,
      passed: check.status === "passed",
      message: check.evidence,
    }));

    // Store gate state for resume (serializable)
    // This enables restoring ReviewGate progress across resume boundaries.
    try {
      ctx.set("reviewGateState", gate.serialize());
    } catch {
      // best-effort; do not fail review stage on serialization issues
    }

    // Store output for resume
    const reviewOutput: ReviewOutput = {
      checks,
      allPassed: gate.isSatisfied(),
      fixAttempts,
    };
    // Don't store review output - checks array contains data that's not guaranteed serializable

    return reviewOutput;
  }

  /**
   * Check agent outcomes and record in gate.
   */
  private async checkAgentOutcomes(
    input: ExecuteOutput,
    gate: import("@alfred/agent/workflow/review-gate").ReviewGate,
    ctx: PipelineContext
  ): Promise<void> {
    for (const [taskId, outcome] of input.outcomes) {
      const passed = outcome.status === "success";

      gate.recordCheck({
        id: taskId,
        type: "agent_completion",
        status: passed ? "passed" : "failed",
        evidence: outcome.escalation ?? outcome.result?.summary,
      });

      // Emit check event
      ctx.emit(
        createEvent("review:check", {
          check: {
            name: `Agent ${taskId}`,
            passed,
            message: outcome.escalation ?? outcome.result?.summary,
          },
        })
      );
    }
  }

  /**
   * Run fixer loop to attempt automatic fixes.
   */
  private async runFixerLoop(
    _input: ExecuteOutput,
    gate: import("@alfred/agent/workflow/review-gate").ReviewGate,
    ctx: PipelineContext,
    startAttempts: number
  ): Promise<number> {
    const maxAttempts = ctx.config.reviewFixer?.maxAttempts ?? 3;
    let attempts = startAttempts;

    // Import fixer utilities
    const { buildFixerSubTask, buildReviewPlan } = await import(
      "@alfred/agent/orchestrator/multi/review"
    );
    const { buildAgentSpec } = await import(
      "@alfred/agent/orchestrator/multi/spawn"
    );
    const { runAgent } = await import("@alfred/runtime/orchestrator/agent");
    const { AsyncQueue } = await import("@alfred/runtime/utils/concurrency");

    while (!gate.isSatisfied() && attempts < maxAttempts) {
      attempts++;
      ctx.set("fixAttempts", attempts as SerializableValue);

      ctx.emit(
        createEvent("review:fix-start", {
          attempt: attempts,
          maxAttempts,
        })
      );

      logger.info("review_fixer_attempt", {
        runId: ctx.runId,
        attempt: attempts,
        maxAttempts,
      });

      try {
        // Build review plan from failed checks
        const failedChecks = gate
          .summary()
          .filter((c) => c.status !== "passed");
        const files = ctx.get<string[]>("changedFiles") ?? [];
        const summary = failedChecks
          .map((c) => `${c.id}: ${c.evidence ?? "failed"}`)
          .join("\n");

        const plan = buildReviewPlan({ files, summary });

        // Build fixer subtask
        const fixerSubTask = buildFixerSubTask({
          attempt: attempts,
          summary: plan.summary ?? summary,
          relevantFiles: files,
        });

        // Build agent spec
        const fixerSpec = buildAgentSpec(
          fixerSubTask,
          ctx.runId,
          ctx.workspace,
          { auto: "medium" }
        );
        fixerSpec.execPlanPath = ctx.get<string>("rootPlanPath") ?? "";

        // Run fixer agent
        const queue = new AsyncQueue<WorkflowEvent>();
        const drainQueue = (async () => {
          for await (const event of queue) {
            ctx.emit(
              createEvent("agent:progress", {
                agentId: fixerSpec.agentId,
                message: this.formatQueueEvent(event),
              })
            );
          }
        })();
        try {
          await runAgent({
            spec: fixerSpec,
            phaseId: "review-fixer",
            runId: ctx.runId,
            workspace: ctx.workspace,
            workspaceRoot: ctx.workspace,
            subTaskById: new Map(),
            projectConfig: ctx.get("projectConfig") ?? null,
            activeWorkspaces: [],
            agentFileHints: new Map(),
            rootExecPlanPath: ctx.get<string>("rootPlanPath") ?? "",
            signal: ctx.signal,
            authz: ctx.get("authz"),
            userId: ctx.userId,
            trackerContextRef: {
              current: {
                state: { agents: {}, waves: {} },
                blockedBy: new Map(),
                dependsOn: new Map(),
                detectors: new Map(),
                options: {
                  noProgressMs: 60_000,
                  maxTransitions: 200,
                  similarityThreshold: 0.92,
                },
              },
            },
            queue,
          });
        } finally {
          queue.close();
          await drainQueue;
        }

        // Re-check outcomes after fix
        // In a real implementation, this would re-run the failed checks
        // For now, we mark the attempt and let the next iteration re-evaluate
        for (const check of failedChecks) {
          gate.recordCheck({
            id: check.id,
            type: check.type,
            status: "pending",
            attempt: attempts,
          });
        }

        const success = gate.isSatisfied();
        ctx.emit(
          createEvent("review:fix-complete", {
            attempt: attempts,
            success,
          })
        );

        // Save gate state metadata after each attempt
        const attemptSummary = gate.summary();
        ctx.set("reviewGateSummary", {
          totalChecks: attemptSummary.length,
          passedChecks: attemptSummary.filter((c) => c.status === "passed")
            .length,
          satisfied: gate.isSatisfied(),
          lastAttempt: attempts,
        });

        logger.info("review_fixer_complete", {
          runId: ctx.runId,
          attempt: attempts,
          success,
        });
      } catch (error) {
        ctx.emit(
          createEvent("review:fix-complete", {
            attempt: attempts,
            success: false,
          })
        );

        logger.error("review_fixer_failed", {
          runId: ctx.runId,
          attempt: attempts,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return attempts;
  }
}
