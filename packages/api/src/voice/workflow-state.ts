/**
 * Voice workflow state machine types.
 *
 * Tracks the state of voice-initiated workflows across utterances,
 * enabling multi-turn voice interactions for plan creation and approval.
 */

/**
 * Voice workflow phases:
 * - idle: No active workflow
 * - planning: Generating plan from voice request
 * - awaiting_approval: Plan ready, waiting for user approval
 * - executing: Agents running
 * - completed: Workflow finished
 */
export type VoiceWorkflowState =
  | { phase: "idle" }
  | { phase: "planning"; runId: string }
  | {
      phase: "awaiting_approval";
      runId: string;
      planId: string;
      summary: string;
      waveCount: number;
      subtaskCount: number;
    }
  | { phase: "executing"; runId: string; startedAt: number }
  | { phase: "completed"; runId: string; completedAt: number };

/**
 * Context stored in voice session for workflow tracking
 */
export interface VoiceWorkflowContext {
  state: VoiceWorkflowState;
  originalTranscript: string;
  createdAt: Date;
  updatedAt: Date;
  /** Deadline for approval (undefined = no timeout) */
  approvalDeadline?: Date;
}

/**
 * Create initial idle state
 */
export function createIdleState(): VoiceWorkflowState {
  return { phase: "idle" };
}

/**
 * Create planning state when workflow intent detected
 */
export function createPlanningState(runId: string): VoiceWorkflowState {
  return { phase: "planning", runId };
}

/**
 * Create awaiting approval state after plan generation
 */
export function createAwaitingApprovalState(params: {
  runId: string;
  planId: string;
  summary: string;
  waveCount: number;
  subtaskCount: number;
}): VoiceWorkflowState {
  return {
    phase: "awaiting_approval",
    runId: params.runId,
    planId: params.planId,
    summary: params.summary,
    waveCount: params.waveCount,
    subtaskCount: params.subtaskCount,
  };
}

/**
 * Create executing state after approval
 */
export function createExecutingState(runId: string): VoiceWorkflowState {
  return { phase: "executing", runId, startedAt: Date.now() };
}

/**
 * Create completed state after workflow finishes
 */
export function createCompletedState(runId: string): VoiceWorkflowState {
  return { phase: "completed", runId, completedAt: Date.now() };
}

/**
 * Check if state is awaiting approval
 */
export function isAwaitingApproval(
  state: VoiceWorkflowState
): state is Extract<VoiceWorkflowState, { phase: "awaiting_approval" }> {
  return state.phase === "awaiting_approval";
}

/**
 * Check if state is executing
 */
export function isExecuting(
  state: VoiceWorkflowState
): state is Extract<VoiceWorkflowState, { phase: "executing" }> {
  return state.phase === "executing";
}

/**
 * Check if state has an active workflow (not idle or completed)
 */
export function hasActiveWorkflow(state: VoiceWorkflowState): boolean {
  return (
    state.phase === "planning" ||
    state.phase === "awaiting_approval" ||
    state.phase === "executing"
  );
}

/**
 * Serialize workflow context for storage
 */
export function serializeWorkflowContext(
  context: VoiceWorkflowContext
): string {
  return JSON.stringify({
    ...context,
    createdAt: context.createdAt.toISOString(),
    updatedAt: context.updatedAt.toISOString(),
    approvalDeadline: context.approvalDeadline?.toISOString(),
  });
}

/**
 * Deserialize workflow context from storage
 */
export function deserializeWorkflowContext(
  json: string
): VoiceWorkflowContext | null {
  try {
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      approvalDeadline: parsed.approvalDeadline
        ? new Date(parsed.approvalDeadline)
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a workflow context has expired (approval timeout)
 */
export function isApprovalExpired(context: VoiceWorkflowContext): boolean {
  if (context.state.phase !== "awaiting_approval") {
    return false;
  }
  if (!context.approvalDeadline) {
    return false;
  }
  return Date.now() > context.approvalDeadline.getTime();
}

/**
 * Calculate approval deadline from timeout in minutes
 */
export function calculateApprovalDeadline(
  timeoutMinutes: number
): Date | undefined {
  if (timeoutMinutes <= 0) {
    return; // No timeout
  }
  return new Date(Date.now() + timeoutMinutes * 60 * 1000);
}
