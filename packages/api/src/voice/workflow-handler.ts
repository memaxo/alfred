/**
 * Voice workflow handlers for plan creation, approval, and status queries.
 *
 * These handlers bridge voice input to the workflow pipeline,
 * returning TTS-optimized responses.
 */

import * as planRepo from "@alfred/db/repo/plan";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { StructuredPlan } from "@alfred/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import type { VoiceAssistantRaw } from "@alfred/type/voice";
import type { VoiceAssistantInput, VoiceAssistantResult } from "./assistant.js";
import {
  clarificationToSpeech,
  planCompletionSummary,
  planStatusSummary,
  planToSpeech,
} from "./plan-speech.js";
import {
  getVoiceWorkflowPreferences,
  type VoiceWorkflowAutoApprove,
  type VoiceWorkflowPreferences,
} from "./preferences.js";
import {
  clearVoiceWorkflowContext,
  getVoiceWorkflowContext,
  setVoiceWorkflowContext,
} from "./session-context.js";
import {
  calculateApprovalDeadline,
  createAwaitingApprovalState,
  createExecutingState,
  isAwaitingApproval,
  type VoiceWorkflowContext,
} from "./workflow-state.js";

/**
 * Handle a workflow intent from voice input.
 *
 * Parses the intent, generates a plan, and returns a voice-optimized summary.
 * Supports auto-approval and verbosity settings from user preferences.
 */
export async function handleWorkflowIntent(
  _ctx: RuntimeContext,
  input: VoiceAssistantInput,
  _sessionContext?: VoiceWorkflowContext
): Promise<VoiceAssistantResult> {
  const startTime = performance.now();

  try {
    // 0. Load user preferences
    const prefs = await getVoiceWorkflowPreferences(input.userId);

    // 1. Parse intent to check for ambiguity
    const { parseIntent } = await import("@alfred/plan");
    const intentResult = await parseIntent(input.text, {
      userId: input.userId,
      source: "voice",
    });

    // 2. Handle clarification needed
    if (intentResult.type === "clarification") {
      const text = clarificationToSpeech(intentResult.questions);
      return createVoiceResult(text, startTime);
    }

    // 3. Handle multi-intent (simplify for voice - just use first intent)
    let requirement = input.text;
    if (
      intentResult.type === "multiIntent" &&
      intentResult.intents.length > 0
    ) {
      const firstIntent = intentResult.intents[0];
      if (firstIntent) {
        requirement = firstIntent.description;
      }
    }

    // 4. Generate plan via pipeline (with learning preference)
    const planResult = await generatePlanViaPipeline(
      input.userId,
      requirement,
      prefs
    );

    // 5. Check for auto-approval
    if (shouldAutoApprove(planResult.structuredPlan, prefs.autoApprove)) {
      // Auto-approve: immediately start execution
      await planRepo.updatePlanStatus(
        planResult.planId,
        "approved",
        input.userId
      );
      await workflowRepo.updateRun(planResult.runId, {
        status: "running",
        suspendedAt: null,
        resumedAt: new Date(),
        errorMessage: null,
      });

      // Store state as executing
      await setVoiceWorkflowContext(input.userId, {
        state: createExecutingState(planResult.runId),
        originalTranscript: input.text,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return auto-approved message
      const autoApproveText = `${planResult.summary.replace(/Say 'approve'.*$/, "")} Auto-approved based on your settings. Agents are now executing.`;
      return createVoiceResult(
        autoApproveText.trim(),
        startTime,
        buildVoiceWorkflowRaw({
          text: autoApproveText.trim(),
          runId: planResult.runId,
          planId: planResult.planId,
          plan: planResult.structuredPlan,
          mode: "executing",
        })
      );
    }

    // 6. Store state in session for approval flow (with timeout)
    await setVoiceWorkflowContext(input.userId, {
      state: createAwaitingApprovalState({
        runId: planResult.runId,
        planId: planResult.planId,
        summary: planResult.summary,
        waveCount: planResult.waveCount,
        subtaskCount: planResult.subtaskCount,
      }),
      originalTranscript: input.text,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvalDeadline: calculateApprovalDeadline(prefs.timeout),
    });

    // 7. Return plan summary for TTS
    return createVoiceResult(
      planResult.summary,
      startTime,
      buildVoiceWorkflowRaw({
        text: planResult.summary,
        runId: planResult.runId,
        planId: planResult.planId,
        plan: planResult.structuredPlan,
        mode: "awaiting_approval",
      })
    );
  } catch (error) {
    logger.error("voice_workflow_intent_failed", {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    const errorText =
      "I encountered an issue creating the plan. Please try again or provide more details about what you'd like to build.";
    return createVoiceResult(errorText, startTime);
  }
}

/**
 * Determine if a plan should be auto-approved based on user setting.
 */
function shouldAutoApprove(
  plan: StructuredPlan,
  setting: VoiceWorkflowAutoApprove
): boolean {
  if (setting === "off") {
    return false;
  }
  if (setting === "all") {
    return true;
  }

  const taskCount = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const phaseCount = plan.phases.length;

  if (setting === "small") {
    return phaseCount === 1 && taskCount <= 3;
  }
  if (setting === "medium") {
    return phaseCount <= 2 && taskCount <= 6;
  }
  return false;
}

/**
 * Handle approval or rejection of a pending plan.
 */
export async function handleApprovalIntent(
  _ctx: RuntimeContext,
  input: VoiceAssistantInput,
  sessionContext: VoiceWorkflowContext | undefined,
  action: "approve" | "reject"
): Promise<VoiceAssistantResult> {
  const startTime = performance.now();

  // Validate we have a plan awaiting approval
  if (!(sessionContext && isAwaitingApproval(sessionContext.state))) {
    const text =
      "There's no plan waiting for approval. Tell me what you'd like to build.";
    return createVoiceResult(text, startTime);
  }

  const { runId, planId } = sessionContext.state;

  try {
    if (action === "approve") {
      // Approve the plan
      await planRepo.updatePlanStatus(planId, "approved", input.userId);

      // Update run status to running
      await workflowRepo.updateRun(runId, {
        status: "running",
        suspendedAt: null,
        resumedAt: new Date(),
        errorMessage: null,
      });

      // Update session state to executing
      await setVoiceWorkflowContext(input.userId, {
        ...sessionContext,
        state: createExecutingState(runId),
        updatedAt: new Date(),
      });

      const text =
        "Plan approved. Agents are now executing. I'll let you know when they're done, or ask for status updates anytime.";
      const status = await getWorkflowStatus(runId).catch(() => null);
      return createVoiceResult(
        text,
        startTime,
        buildVoiceWorkflowRaw({
          text,
          runId,
          planId,
          plan: status?.plan as StructuredPlan | undefined,
          mode: "executing",
        })
      );
    }

    // Rejection
    await planRepo.updatePlanStatus(planId, "rejected", input.userId);
    await workflowRepo.updateRun(runId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: "Rejected via voice",
    });
    await clearVoiceWorkflowContext(input.userId);

    const text =
      "Plan rejected. Let me know if you'd like to try a different approach or refine your requirements.";
    return createVoiceResult(
      text,
      startTime,
      buildVoiceWorkflowRaw({
        text,
        runId,
        planId,
        plan: undefined,
        mode: "rejected",
      })
    );
  } catch (error) {
    logger.error("voice_approval_intent_failed", {
      userId: input.userId,
      action,
      runId,
      error: error instanceof Error ? error.message : String(error),
    });

    const errorText =
      action === "approve"
        ? "I couldn't start the execution. Please try approving again or check the web interface."
        : "I couldn't reject the plan. Please try again.";
    return createVoiceResult(errorText, startTime);
  }
}

/**
 * Handle status query for an executing workflow.
 */
export async function handleStatusQuery(
  _ctx: RuntimeContext,
  input: VoiceAssistantInput,
  runId?: string
): Promise<VoiceAssistantResult> {
  const startTime = performance.now();

  // Get context to find the active run
  const sessionContext = await getVoiceWorkflowContext(input.userId);

  // Determine which run to check
  let targetRunId = runId;
  if (!targetRunId && sessionContext?.state.phase === "executing") {
    targetRunId = sessionContext.state.runId;
  }

  if (!targetRunId) {
    const text =
      "I don't have an active workflow to check. Would you like to start a new one?";
    return createVoiceResult(text, startTime);
  }

  try {
    const status = await getWorkflowStatus(targetRunId);

    if (status.status === "completed") {
      // Update session state
      await clearVoiceWorkflowContext(input.userId);

      const text = planCompletionSummary(
        status.plan,
        status.success,
        status.durationMs
      );
      return createVoiceResult(
        text,
        startTime,
        buildVoiceWorkflowRaw({
          text,
          runId: targetRunId,
          planId: (status.plan as StructuredPlan).id,
          plan: status.plan as StructuredPlan,
          mode: "completed",
        })
      );
    }

    if (status.status === "running") {
      const text = planStatusSummary(
        status.plan,
        status.completedTasks,
        status.totalTasks
      );
      return createVoiceResult(
        text,
        startTime,
        buildVoiceWorkflowRaw({
          text,
          runId: targetRunId,
          planId: (status.plan as StructuredPlan).id,
          plan: status.plan as StructuredPlan,
          mode: "executing",
        })
      );
    }

    if (status.status === "failed") {
      await clearVoiceWorkflowContext(input.userId);
      const text =
        "The workflow encountered an error and stopped. Check the web interface for details on what went wrong.";
      return createVoiceResult(
        text,
        startTime,
        buildVoiceWorkflowRaw({
          text,
          runId: targetRunId,
          planId: (status.plan as StructuredPlan).id,
          plan: status.plan as StructuredPlan,
          mode: "failed",
        })
      );
    }

    // Suspended or other status
    const text = `The workflow is currently ${status.status}. Let me know if you'd like to resume or start over.`;
    return createVoiceResult(text, startTime);
  } catch (error) {
    logger.error("voice_status_query_failed", {
      userId: input.userId,
      runId: targetRunId,
      error: error instanceof Error ? error.message : String(error),
    });

    const text =
      "I couldn't get the workflow status. Please check the web interface.";
    return createVoiceResult(text, startTime);
  }
}

// --- Internal helpers ---

type VoiceWorkflowRawMode =
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

function toWorkflowTimeline(
  plan: StructuredPlan | undefined,
  mode: VoiceWorkflowRawMode
) {
  const planPhase = {
    id: "plan",
    name: "Plan",
    status: "completed" as const,
    progress: 100,
    tasks: [
      {
        id: "plan_generated",
        name: "Plan generated",
        status: "completed" as const,
      },
    ],
  };

  const approvalPhase = {
    id: "approval",
    name: "Approval",
    status:
      mode === "awaiting_approval"
        ? ("running" as const)
        : mode === "rejected"
          ? ("error" as const)
          : ("completed" as const),
    progress: mode === "awaiting_approval" ? 50 : mode === "rejected" ? 0 : 100,
    tasks: [
      {
        id: "approve_plan",
        name: mode === "awaiting_approval" ? "Awaiting approval" : "Approved",
        status:
          mode === "awaiting_approval"
            ? ("running" as const)
            : mode === "rejected"
              ? ("error" as const)
              : ("completed" as const),
      },
    ],
  };

  const execStatus =
    mode === "completed"
      ? ("completed" as const)
      : mode === "failed"
        ? ("error" as const)
        : mode === "executing"
          ? ("running" as const)
          : ("pending" as const);

  const execPhases = (plan?.phases ?? []).map((phase, idx) => ({
    id: phase.id,
    name: phase.name,
    status:
      idx === 0 && mode === "executing" ? ("running" as const) : execStatus,
    progress:
      execStatus === "completed" ? 100 : execStatus === "running" ? 10 : 0,
    tasks: phase.tasks.map((task) => ({
      id: task.id,
      name: task.title,
      status: execStatus,
      dependencies: task.deps.length ? task.deps : undefined,
    })),
  }));

  return [planPhase, approvalPhase, ...execPhases];
}

function toPlanComponent(plan: StructuredPlan | undefined) {
  const requirement = plan?.intent ?? "";
  const tasks =
    plan?.phases.flatMap((p) =>
      p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: "pending" as const,
      }))
    ) ?? [];

  return {
    component: "plan",
    props: { plan: { requirement, tasks } },
  } as const;
}

function buildVoiceWorkflowRaw(input: {
  text: string;
  runId: string;
  planId: string;
  plan: StructuredPlan | undefined;
  mode: VoiceWorkflowRawMode;
}): VoiceAssistantRaw {
  const timelinePart = {
    type: "data-ui",
    data: {
      kind: "workflow-timeline",
      runId: input.runId,
      planId: input.planId,
    },
    ui: {
      component: "workflow-timeline",
      props: {
        workflowId: input.runId,
        title: input.plan?.title ?? "Workflow",
        phases: toWorkflowTimeline(input.plan, input.mode),
        elapsed: 0,
      },
    },
  } as unknown as UIMessage["parts"][number];

  const planPart = {
    type: "data-ui",
    data: { kind: "plan", runId: input.runId, planId: input.planId },
    ui: toPlanComponent(input.plan),
  } as unknown as UIMessage["parts"][number];

  const message: UIMessage = {
    id: `voice-workflow-${Date.now()}`,
    role: "assistant",
    parts: [{ type: "text", text: input.text }, timelinePart, planPart],
  };

  return {
    uiMessages: [message],
    meta: { runId: input.runId, planId: input.planId, mode: input.mode },
  };
}

/**
 * Generate a plan via the workflow pipeline (directly, not via tRPC)
 */
async function generatePlanViaPipeline(
  userId: string,
  requirement: string,
  prefs: VoiceWorkflowPreferences
): Promise<{
  runId: string;
  planId: string;
  summary: string;
  waveCount: number;
  subtaskCount: number;
  structuredPlan: StructuredPlan;
}> {
  const { PipelineRunner, registerDefaultStages } = await import(
    "@alfred/pipeline"
  );
  const { CheckpointObserver, MetricsObserver } = await import(
    "@alfred/pipeline/observers"
  );
  const { PostgresCheckpointStorage } = await import(
    "@alfred/db/repo/workflow"
  );
  const { createContextFromSnapshot } = await import(
    "@alfred/pipeline/snapshot"
  );

  // Type for pipeline snapshot
  type PipelineSnapshot = Parameters<typeof createContextFromSnapshot>[0];

  const runId = crypto.randomUUID();
  const workspace = process.cwd();

  // Ensure a workflow run row exists before snapshots are persisted
  await workflowRepo.createRun({
    id: runId,
    userId,
    projectId: undefined,
    planId: undefined,
    requirement,
    workflowId: "pipeline",
    status: "running",
    inputData: { requirement, workspace, runId },
  });

  const runner = new PipelineRunner({
    maxParallel: 1,
    enableLearning: prefs.learning, // Use learning preference
    enableLinearSync: false,
  });
  registerDefaultStages(runner);

  // PostgresCheckpointStorage implements CheckpointStorage interface
  const storage = new PostgresCheckpointStorage();
  runner.addObserver(new MetricsObserver());
  // Use type assertion for CheckpointObserver which expects CheckpointStorage
  // biome-ignore lint/suspicious/noExplicitAny: PostgresCheckpointStorage conforms to CheckpointStorage interface
  runner.addObserver(new CheckpointObserver(storage as any));

  const pipelineInput = {
    runId,
    requirement,
    workspace,
    userId,
  };

  // Run pipeline up to and including 'schedule' stage
  for await (const _event of runner.runUntilStage(pipelineInput, "schedule")) {
    // Events consumed; outputs stored in context by checkpoint observer
  }

  // Load the snapshot to get all outputs
  const rawSnapshot = await storage.load(runId);
  if (!rawSnapshot) {
    throw new Error("snapshot_not_found_after_plan");
  }
  const snapshot = rawSnapshot as PipelineSnapshot;

  const ctxDecoded = createContextFromSnapshot(snapshot, { emit: () => {} });

  const scheduleOutput = ctxDecoded.get("scheduleOutput") as
    | {
        waves: Array<{ id: string; agents: string[] }>;
      }
    | undefined;

  const planOutput = ctxDecoded.get("planOutput") as
    | {
        planId: string;
        structuredPlan: unknown;
        subtasks: Array<{ id: string }>;
      }
    | undefined;

  if (!planOutput?.planId) {
    throw new Error("plan_generation_failed");
  }

  // Mark the run as awaiting approval
  await workflowRepo.updateRun(runId, {
    status: "suspended",
    planId: planOutput.planId,
    suspendedAt: new Date(),
  });

  // Generate voice-optimized summary with verbosity preference
  const structuredPlan = planOutput.structuredPlan as StructuredPlan;
  const summary = planToSpeech(structuredPlan, { verbosity: prefs.verbosity });

  return {
    runId,
    planId: planOutput.planId,
    summary,
    waveCount: scheduleOutput?.waves?.length ?? 1,
    subtaskCount: planOutput.subtasks?.length ?? 0,
    structuredPlan,
  };
}

/**
 * Get workflow status
 */
async function getWorkflowStatus(runId: string): Promise<{
  status: "running" | "completed" | "failed" | "suspended" | "idle";
  success: boolean;
  completedTasks: number;
  totalTasks: number;
  durationMs: number;
  plan: Parameters<typeof planStatusSummary>[0];
}> {
  const { PostgresCheckpointStorage } = await import(
    "@alfred/db/repo/workflow"
  );
  const { createContextFromSnapshot } = await import(
    "@alfred/pipeline/snapshot"
  );

  const run = await workflowRepo.getRun(runId);
  if (!run) {
    throw new Error("workflow_run_not_found");
  }

  // Type for snapshot
  type PipelineSnapshot = Parameters<typeof createContextFromSnapshot>[0];

  // Default plan structure
  let plan: Parameters<typeof planStatusSummary>[0] = {
    id: runId,
    title: "Workflow",
    intent: run.requirement ?? "",
    phases: [],
    resources: { agentCount: 1, strategy: "sequential", isolation: "agentfs" },
    evaluationCriteria: [],
  };

  let totalTasks = 0;
  let completedTasks = 0;

  // Load snapshot to get plan details
  const storage = new PostgresCheckpointStorage();
  const rawSnapshot = await storage.load(runId);
  const snapshot = rawSnapshot as PipelineSnapshot | null;

  if (snapshot) {
    const ctxDecoded = createContextFromSnapshot(snapshot, { emit: () => {} });
    const planOutput = ctxDecoded.get("planOutput") as
      | { structuredPlan?: unknown; subtasks?: unknown[] }
      | undefined;

    if (planOutput?.structuredPlan) {
      plan = planOutput.structuredPlan as typeof plan;
    }

    if (planOutput?.subtasks && Array.isArray(planOutput.subtasks)) {
      totalTasks = planOutput.subtasks.length;
    }

    // Estimate completed tasks from stage progress
    const stageResults = snapshot.stageResults ?? [];
    const executeStage = stageResults.find(
      (s: { name: string; status: string }) => s.name === "execute"
    );
    if (executeStage?.status === "success") {
      completedTasks = totalTasks;
    } else if (snapshot.status === "running") {
      // Rough estimate based on elapsed time
      completedTasks = Math.floor(totalTasks * 0.5);
    }
  }

  const startedAt = run.created?.getTime() ?? Date.now();
  const endedAt = run.completedAt?.getTime() ?? Date.now();
  const durationMs = endedAt - startedAt;

  return {
    status: run.status as
      | "running"
      | "completed"
      | "failed"
      | "suspended"
      | "idle",
    success: run.status === "completed",
    completedTasks,
    totalTasks,
    durationMs,
    plan,
  };
}

/**
 * Create a voice result with timing
 */
function createVoiceResult(
  text: string,
  startTime: number,
  raw?: VoiceAssistantRaw
): VoiceAssistantResult {
  const durationSeconds = (performance.now() - startTime) / 1000;

  return {
    text,
    replayId: null,
    raw:
      raw ??
      ({
        uiMessages: [
          {
            id: `voice-workflow-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text", text }],
          } satisfies UIMessage,
        ],
      } satisfies VoiceAssistantRaw),
    durationSeconds,
  };
}
