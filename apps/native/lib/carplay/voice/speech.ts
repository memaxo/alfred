/**
 * CarPlay Speech Generator Bridge
 *
 * Wraps ALFRED's existing plan-speech utilities for CarPlay context.
 * Provides voice-optimized text generation for orchestrator data.
 *
 * This is a BRIDGE - it adapts existing speech generators for CarPlay types.
 * Core speech generation logic lives in:
 * - packages/api/src/voice/plan-speech.ts
 */

import type {
  Escalation,
  EscalationPriority,
  ExecPlan,
  PullRequest,
  WorkflowState,
} from "../types";

// Priority labels for voice
const PRIORITY_LABELS: Record<EscalationPriority, string> = {
  critical: "Urgent decision needed.",
  high: "Decision needed.",
  normal: "",
};

// Workflow status labels
const STATUS_LABELS: Record<WorkflowState["status"], string> = {
  running: "running",
  suspended: "paused",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
};

/**
 * Truncate text for voice output (avoid overly long utterances)
 */
function truncateForSpeech(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return `${words.slice(0, maxWords).join(" ")}...`;
}

/**
 * Pluralize a word based on count
 */
function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }
  const irregulars: Record<string, string> = {
    phase: "phases",
    task: "tasks",
    workflow: "workflows",
    agent: "agents",
    minute: "minutes",
    hour: "hours",
    file: "files",
    line: "lines",
    decision: "decisions",
  };
  return irregulars[word] ?? `${word}s`;
}

/**
 * Generate speech for escalation announcement.
 * Called when a new escalation arrives or user views escalation details.
 */
export function speakEscalation(escalation: Escalation): string {
  const priorityPrefix = PRIORITY_LABELS[escalation.priority] || "";
  const workflowContext = `${truncateForSpeech(escalation.workflowName, 8)} has a question.`;
  const question = truncateForSpeech(escalation.question, 20);

  const suggestion = escalation.suggestions?.[0]
    ? `Suggestion: ${truncateForSpeech(escalation.suggestions[0], 10)}.`
    : "";

  const prompt = "Say approve, reject, or defer.";

  return [priorityPrefix, workflowContext, question, suggestion, prompt]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generate speech for workflow status update.
 */
export function speakWorkflowUpdate(
  workflow: WorkflowState,
  event: "started" | "progress" | "completed" | "failed" | "paused"
): string {
  const name = truncateForSpeech(workflow.requirement, 8);

  switch (event) {
    case "started": {
      return `Starting workflow: ${name}.`;
    }
    case "progress": {
      const progressText = `${name} is ${workflow.progress}% complete.`;
      const taskText = workflow.currentTask
        ? `Currently: ${truncateForSpeech(workflow.currentTask, 6)}.`
        : "";
      return `${progressText} ${taskText}`.trim();
    }
    case "completed": {
      return `Workflow complete: ${name}. ${workflow.completedTasks} ${pluralize("task", workflow.completedTasks)} finished.`;
    }
    case "failed": {
      return `Workflow failed: ${name}. Check the app for details.`;
    }
    case "paused": {
      return `Workflow paused: ${name}. Say resume when ready.`;
    }
    default: {
      return `${name}: ${event}.`;
    }
  }
}

/**
 * Generate speech for PR summary.
 */
export function speakPRSummary(pr: PullRequest): string {
  const title = truncateForSpeech(pr.title, 10);
  const changes = `${pr.additions} ${pluralize("line", pr.additions)} added, ${pr.deletions} removed.`;

  let ciStatus = "";
  switch (pr.ciStatus) {
    case "success": {
      ciStatus = "CI passing.";
      break;
    }
    case "failure": {
      ciStatus = "CI failing.";
      break;
    }
    case "pending": {
      ciStatus = "CI running.";
      break;
    }
  }

  const prompt = "Say approve to merge, or defer to review later.";

  return `Pull request ${pr.number}: ${title}. ${changes} ${ciStatus} ${prompt}`;
}

/**
 * Generate speech for plan summary.
 */
export function speakPlanSummary(plan: ExecPlan): string {
  const title = truncateForSpeech(plan.requirement, 10);

  const phaseCount = plan.phases.length;
  const scope =
    phaseCount === 1
      ? `1 phase with ${plan.subtaskCount} ${pluralize("task", plan.subtaskCount)}`
      : `${phaseCount} ${pluralize("phase", phaseCount)} with ${plan.subtaskCount} ${pluralize("task", plan.subtaskCount)}`;

  const time = `Estimated ${plan.estimatedTime} ${pluralize("minute", plan.estimatedTime)}.`;

  let risk = "";
  switch (plan.riskLevel) {
    case "high": {
      risk = "High risk.";
      break;
    }
    case "medium": {
      risk = "Medium risk.";
      break;
    }
  }

  const prompt = "Say approve to start, modify to adjust scope, or reject.";

  return [title, scope, time, risk, prompt].filter(Boolean).join(" ");
}

/**
 * Generate speech for workflow status query response.
 * Called when user asks "what's the status?" or similar.
 */
export function speakWorkflowStatus(workflows: WorkflowState[]): string {
  if (workflows.length === 0) {
    return "No active workflows. Would you like to start a new task?";
  }

  if (workflows.length === 1) {
    const w = workflows[0]!;
    const name = truncateForSpeech(w.requirement, 8);
    const taskInfo = w.currentTask
      ? `Currently: ${truncateForSpeech(w.currentTask, 6)}.`
      : "";
    return `One workflow ${STATUS_LABELS[w.status]}: ${name}. ${w.progress}% complete. ${taskInfo}`.trim();
  }

  const running = workflows.filter((w) => w.status === "running").length;
  const suspended = workflows.filter((w) => w.status === "suspended").length;

  let summary = `${workflows.length} ${pluralize("workflow", workflows.length)}. `;
  if (running > 0) {
    summary += `${running} running. `;
  }
  if (suspended > 0) {
    summary += `${suspended} paused. `;
  }

  // Mention the most recent one
  const latest = workflows[0]!;
  summary += `Latest: ${truncateForSpeech(latest.requirement, 6)} at ${latest.progress}%.`;

  return summary;
}

/**
 * Generate speech for decision queue summary.
 * Called when user navigates to decisions tab or asks about pending decisions.
 */
export function speakDecisionQueueSummary(
  escalations: Escalation[],
  reviewCount: number
): string {
  const total = escalations.length + reviewCount;

  if (total === 0) {
    return "No pending decisions. All caught up.";
  }

  const critical = escalations.filter((e) => e.priority === "critical").length;
  const high = escalations.filter((e) => e.priority === "high").length;

  let summary = `${total} ${pluralize("decision", total)} pending. `;
  if (critical > 0) {
    summary += `${critical} critical. `;
  }
  if (high > 0) {
    summary += `${high} high priority. `;
  }

  if (escalations.length > 0) {
    const next = escalations[0]!;
    summary += `Next: ${truncateForSpeech(next.question, 8)}. Say approve, reject, or skip.`;
  }

  return summary;
}

/**
 * Generate confirmation speech for completed action.
 */
export function speakConfirmation(
  action:
    | "approved"
    | "rejected"
    | "deferred"
    | "paused"
    | "resumed"
    | "cancelled",
  context?: string
): string {
  const contextStr = context ? ` ${truncateForSpeech(context, 6)}` : "";

  switch (action) {
    case "approved": {
      return `Approved${contextStr}. Proceeding.`;
    }
    case "rejected": {
      return `Rejected${contextStr}.`;
    }
    case "deferred": {
      return `Deferred${contextStr}. I'll remind you later.`;
    }
    case "paused": {
      return `Paused${contextStr}. Say resume when ready.`;
    }
    case "resumed": {
      return `Resuming${contextStr}.`;
    }
    case "cancelled": {
      return `Cancelled${contextStr}.`;
    }
    default: {
      return "Done.";
    }
  }
}

/**
 * Generate error speech.
 */
export function speakError(context: string): string {
  return `Something went wrong with ${truncateForSpeech(context, 6)}. Please try again or check the app.`;
}

/**
 * Generate greeting/welcome speech.
 */
export function speakGreeting(
  workflowCount: number,
  decisionCount: number
): string {
  const parts: string[] = ["Hello."];

  if (workflowCount > 0) {
    parts.push(
      `${workflowCount} ${pluralize("workflow", workflowCount)} active.`
    );
  }

  if (decisionCount > 0) {
    parts.push(
      `${decisionCount} ${pluralize("decision", decisionCount)} pending.`
    );
  }

  if (workflowCount === 0 && decisionCount === 0) {
    parts.push("All clear. What would you like to work on?");
  } else {
    parts.push("How can I help?");
  }

  return parts.join(" ");
}

/**
 * Generate speech for listening prompt.
 */
export function speakListeningPrompt(): string {
  return "I'm listening.";
}

/**
 * Generate speech for processing acknowledgment.
 */
export function speakProcessing(): string {
  return "Let me think about that.";
}
