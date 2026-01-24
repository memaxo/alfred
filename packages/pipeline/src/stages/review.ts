import { logger } from "@alfred/logger";
import { type WorkflowEvent } from "@alfred/type";

import { createEvent } from "../events";
import { type PipelineContext, type PipelineStage } from "../pipeline";
import { type SerializableValue } from "../snapshot";
import {
  type ExecuteOutput,
  type ReviewCheck,
  type ReviewOutput,
} from "./types";

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
        message: "Running quality checks",
        stage: "review",
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
        checkCount: savedGateState.checks?.length ?? 0,
        runId: ctx.runId,
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
        passedChecks: gateSummary.filter((c) => c.status === "passed").length,
        satisfied: gate.isSatisfied(),
        totalChecks: gateSummary.length,
      });

      // Fixer loop (if enabled and gate not satisfied)
      const fixerConfig = ctx.config.reviewFixer;
      if (fixerConfig?.enabled && !gate.isSatisfied()) {
        fixAttempts = await this.runFixerLoop(input, gate, ctx, fixAttempts);
      }

      // Final gate state metadata
      const finalSummary = gate.summary();
      ctx.set("reviewGateSummary", {
        passedChecks: finalSummary.filter((c) => c.status === "passed").length,
        satisfied: gate.isSatisfied(),
        totalChecks: finalSummary.length,
      });
      ctx.set("fixAttempts", fixAttempts);

      logger.info("review_stage_complete", {
        allPassed: gate.isSatisfied(),
        checkCount: gate.summary().length,
        fixAttempts,
        runId: ctx.runId,
      });
    } catch (error) {
      logger.error("review_stage_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.runId,
      });
    }

    // Convert gate summary to ReviewCheck format
    const checks: ReviewCheck[] = gate.summary().map((check) => ({
      message: check.evidence,
      name: check.id,
      passed: check.status === "passed",
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
      allPassed: gate.isSatisfied(),
      checks,
      fixAttempts,
    };
    // Don't store review output - checks array contains data that's not guaranteed serializable

    return reviewOutput;
  }

  /**
   * Check agent outcomes and record in gate.
   */
  private checkAgentOutcomes(
    input: ExecuteOutput,
    gate: import("@alfred/agent/workflow/review-gate").ReviewGate,
    ctx: PipelineContext
  ): void {
    for (const [taskId, outcome] of input.outcomes) {
      const passed = outcome.status === "success";

      gate.recordCheck({
        evidence: outcome.escalation ?? outcome.result?.summary,
        id: taskId,
        status: passed ? "passed" : "failed",
        type: "agent_completion",
      });

      // Emit check event
      ctx.emit(
        createEvent("review:check", {
          check: {
            message: outcome.escalation ?? outcome.result?.summary,
            name: `Agent ${taskId}`,
            passed,
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
    const { buildFixerSubTask, buildReviewPlan } =
      await import("@alfred/agent/orchestrator/multi/review");
    const { buildAgentSpec } =
      await import("@alfred/agent/orchestrator/multi/spawn");
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
        attempt: attempts,
        maxAttempts,
        runId: ctx.runId,
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
          relevantFiles: files,
          summary: plan.summary ?? summary,
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
            activeWorkspaces: [],
            agentFileHints: new Map(),
            authz: ctx.get("authz"),
            phaseId: "review-fixer",
            projectConfig: ctx.get("projectConfig") ?? null,
            queue,
            rootExecPlanPath: ctx.get<string>("rootPlanPath") ?? "",
            runId: ctx.runId,
            signal: ctx.signal,
            spec: fixerSpec,
            subTaskById: new Map(),
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
                  maxTimeMs: 600_000,
                  maxRepeatedErrors: 5,
                },
              },
            },
            userId: ctx.userId,
            workspace: ctx.workspace,
            workspaceRoot: ctx.workspace,
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
            attempt: attempts,
            id: check.id,
            status: "pending",
            type: check.type,
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
          lastAttempt: attempts,
          passedChecks: attemptSummary.filter((c) => c.status === "passed")
            .length,
          satisfied: gate.isSatisfied(),
          totalChecks: attemptSummary.length,
        });

        logger.info("review_fixer_complete", {
          attempt: attempts,
          runId: ctx.runId,
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
          attempt: attempts,
          error: error instanceof Error ? error.message : String(error),
          runId: ctx.runId,
        });
      }
    }

    return attempts;
  }
}
