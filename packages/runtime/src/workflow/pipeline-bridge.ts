/**
 * Bridge between new @alfred/pipeline and existing workflow orchestrator
 *
 * This module converts PipelineEvent streams to WorkflowEvent streams,
 * enabling gradual migration from the old orchestrator to the new pipeline.
 */

import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import { logger } from "@alfred/logger";
import {
  ConsoleObserver,
  MetricsObserver,
  PipelineRunner,
  WorkflowEventObserver,
  registerDefaultStages,
  type PipelineEvent,
} from "@alfred/pipeline";
import type { WorkflowEvent } from "@alfred/type";

/**
 * Check if the new pipeline is enabled via environment variable
 */
export function isPipelineEnabled(): boolean {
  return process.env.ALFRED_USE_PIPELINE === "1";
}

/**
 * Run workflow using the new pipeline architecture
 *
 * This is a compatibility layer that:
 * 1. Converts WorkflowInputPayload to PipelineInput
 * 2. Runs the pipeline with all 8 stages
 * 3. Bridges PipelineEvent to WorkflowEvent for backwards compatibility
 */
export async function* runWorkflowPipeline(
  input: WorkflowInputPayload,
  session: { user: { id: string } }
): AsyncGenerator<WorkflowEvent, void, void> {
  const runId = input.runId ?? crypto.randomUUID();

  logger.info("pipeline_workflow_start", {
    runId,
    requirement: input.requirement,
    mode: input.mode,
  });

  // Create pipeline runner with configuration
  const runner = new PipelineRunner({
    maxParallel: input.mode === "parallel" ? (input.toolgraph?.maxParallel ?? 4) : 1,
    enableLearning: true,
    enableLinearSync: Boolean(input.linear?.sessionId),
    linearSyncInterval: 30_000, // 30 seconds
  });

  // Register all default stages
  registerDefaultStages(runner);

  // Add console observer for debugging
  if (process.env.NODE_ENV === "development") {
    runner.addObserver(new ConsoleObserver());
  }

  // Add metrics observer
  runner.addObserver(new MetricsObserver());

  // Add Linear sync observer if configured
  if (input.linear?.sessionId && input.authzLinear) {
    const { LinearSyncObserver } = await import("@alfred/pipeline/observers");
    runner.addObserver(
      new LinearSyncObserver({
        syncIntervalMs: 30_000,
        issueId: input.linear.issueId ?? input.linear.sessionId,
        authz: input.authzLinear,
      })
    );
  }

  // Collect workflow events for emission
  const workflowEvents: WorkflowEvent[] = [];
  runner.addObserver(
    new WorkflowEventObserver((event) => {
      workflowEvents.push(event);
    })
  );

  try {
    // Convert input to pipeline format
    const pipelineInput = {
      runId,
      requirement: input.requirement,
      workspace: input.workspace ?? input.cw ?? process.cwd(),
      userId: session.user.id,
      linear: input.linear
        ? {
            sessionId: input.linear.sessionId,
            space: input.linear.space,
            issueId: input.linear.issueId,
            authz: input.authzLinear ?? "",
          }
        : undefined,
    };

    // Run pipeline and emit events
    for await (const event of runner.run(pipelineInput)) {
      // Convert and yield workflow event
      const workflowEvent = pipelineEventToWorkflowEvent(event);
      if (workflowEvent) {
        yield workflowEvent;
      }

      // Also yield any buffered events from observer
      while (workflowEvents.length > 0) {
        const buffered = workflowEvents.shift();
        if (buffered) {
          yield buffered;
        }
      }
    }

    // Final completion event
    yield { _: "workflow-complete", runId } as WorkflowEvent;

    logger.info("pipeline_workflow_complete", { runId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("pipeline_workflow_failed", {
      runId,
      error: errorMessage,
    });

    yield {
      _: "error",
      message: errorMessage,
    } as WorkflowEvent;

    throw error;
  }
}

/**
 * Convert PipelineEvent to WorkflowEvent for backwards compatibility
 */
function pipelineEventToWorkflowEvent(
  event: PipelineEvent
): WorkflowEvent | null {
  switch (event.type) {
    case "stage:enter":
      return { _: "step-start", phase: event.stage };

    case "stage:exit":
      return { _: "step-complete", phase: event.stage };

    case "stage:progress":
      return {
        _: "progress",
        phase: event.stage,
        message: event.message,
      };

    case "agent:spawn":
      return {
        _: "agent-start",
        agentId: event.agentId,
        taskId: event.taskId,
      };

    case "agent:complete":
      return {
        _: "agent-complete",
        agentId: event.agentId,
        status: event.outcome.status,
        durationMs: event.outcome.durationMs,
      };

    case "pipeline:complete":
      return {
        _: "workflow-complete",
        summary: event.summary,
      };

    case "pipeline:failed":
      return {
        _: "error",
        message: event.error,
        phase: event.lastStage,
      };

    default:
      // Events like review:check, learn:insight don't have direct workflow equivalents
      return null;
  }
}
