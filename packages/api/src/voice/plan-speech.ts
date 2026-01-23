/**
 * Plan-to-speech converter for voice workflow presentation.
 *
 * Converts StructuredPlan objects to natural language summaries
 * optimized for TTS synthesis and voice interaction.
 */

import type { Phase, StructuredPlan } from "@alfred/plan";
import { renderHonorific, type HonorificPreference } from "@alfred/persona";
import type { VoiceWorkflowVerbosity } from "./preferences.js";

/**
 * Options for plan-to-speech conversion
 */
export type PlanToSpeechOptions = {
  /** Include phase details (default: true for plans with <= 5 phases) */
  includePhaseDetails?: boolean;
  /** Include task count per phase (default: true) */
  includeTaskCounts?: boolean;
  /** Maximum number of phases to describe in detail */
  maxPhasesToDescribe?: number;
  /** Include approval prompt (default: true) */
  includeApprovalPrompt?: boolean;
  /** Brief mode for shorter responses */
  brief?: boolean;
  /** Verbosity level (overrides brief if set) */
  verbosity?: VoiceWorkflowVerbosity;
  /** Honorific preference for addressing the user */
  honorific?: HonorificPreference;
};

/**
 * Convert a StructuredPlan to a natural language summary for TTS.
 *
 * Verbosity levels:
 * - brief: Phase count + task count only, minimal info
 * - standard: Phase names + task counts (default)
 * - detailed: Phase descriptions + duration estimates + all details
 *
 * Example output (standard):
 * "I've created a plan with 3 phases. Phase 1: Set up database schema with 2 tasks.
 *  Phase 2: Implement API endpoints with 3 tasks. Phase 3: Add tests with 2 tasks.
 *  This will run 4 agents in 2 waves. Say 'approve' to proceed or 'reject' to cancel."
 */
export function planToSpeech(
  plan: StructuredPlan,
  options: PlanToSpeechOptions = {}
): string {
  const { includeApprovalPrompt = true, verbosity = "standard", honorific } =
    options;

  // Determine settings based on verbosity level
  const isBrief = verbosity === "brief" || options.brief === true;
  const isDetailed = verbosity === "detailed";

  const includePhaseDetails =
    options.includePhaseDetails ?? (!isBrief && plan.phases.length <= 5);
  const includeTaskCounts = options.includeTaskCounts ?? !isBrief;
  const maxPhasesToDescribe =
    options.maxPhasesToDescribe ?? (isDetailed ? 10 : 5);
  const includeDescriptions = isDetailed;
  const includeDuration = !isBrief;

  const parts: string[] = [];

  // Opening
  if (isBrief) {
    parts.push(withHonorific(formatBriefOpening(plan), honorific));
  } else {
    parts.push(withHonorific(formatOpening(plan), honorific));
  }

  // Phase details
  if (includePhaseDetails && !isBrief) {
    parts.push(
      formatPhaseDetails(plan.phases, {
        includeTaskCounts,
        maxPhases: maxPhasesToDescribe,
        includeDescriptions,
      })
    );
  }

  // Execution info
  if (!isBrief) {
    parts.push(formatExecutionInfo(plan));
  }

  // Duration estimate if available (standard and detailed only)
  if (includeDuration) {
    const durationEstimate = formatDurationEstimate(plan);
    if (durationEstimate) {
      parts.push(durationEstimate);
    }
  }

  // Approval prompt
  if (includeApprovalPrompt) {
    parts.push(formatApprovalPrompt());
  }

  return parts.filter(Boolean).join(" ");
}

function withHonorific(
  sentence: string,
  honorific: HonorificPreference | undefined
): string {
  if (!honorific) {
    return sentence;
  }
  const h = renderHonorific(honorific);
  const s = sentence.trim();
  if (!s) {
    return s;
  }
  if (s.endsWith(".")) {
    return `${s.slice(0, -1)}, ${h}.`;
  }
  if (s.endsWith("!") || s.endsWith("?")) {
    return `${s} ${h}.`;
  }
  return `${s}, ${h}.`;
}

/**
 * Format the opening statement
 */
function formatOpening(plan: StructuredPlan): string {
  const phaseCount = plan.phases.length;
  const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);

  if (phaseCount === 1) {
    const phase = plan.phases[0];
    if (!phase) {
      return "I've created a plan for this task.";
    }
    return `I've created a plan with ${totalTasks} ${pluralize("task", totalTasks)}.`;
  }

  return `I've created a plan with ${phaseCount} ${pluralize("phase", phaseCount)} and ${totalTasks} total ${pluralize("task", totalTasks)}.`;
}

/**
 * Format brief opening for short responses
 */
function formatBriefOpening(plan: StructuredPlan): string {
  const phaseCount = plan.phases.length;
  const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);

  return `Plan ready: ${phaseCount} ${pluralize("phase", phaseCount)}, ${totalTasks} ${pluralize("task", totalTasks)}.`;
}

/**
 * Format phase details
 */
function formatPhaseDetails(
  phases: Phase[],
  options: {
    includeTaskCounts: boolean;
    maxPhases: number;
    includeDescriptions?: boolean;
  }
): string {
  const { includeTaskCounts, maxPhases, includeDescriptions = false } = options;
  const phasesToDescribe = phases.slice(0, maxPhases);
  const remaining = phases.length - phasesToDescribe.length;

  const descriptions = phasesToDescribe.map((phase, index) => {
    const taskCount = phase.tasks.length;
    const taskSuffix = includeTaskCounts
      ? ` with ${taskCount} ${pluralize("task", taskCount)}`
      : "";

    // Clean up phase name for speech
    const phaseName = cleanForSpeech(phase.name);

    let phaseText = `Phase ${index + 1}: ${phaseName}${taskSuffix}`;

    // Add description for detailed verbosity
    if (includeDescriptions && phase.description) {
      const cleanDescription = cleanForSpeech(phase.description);
      if (cleanDescription && cleanDescription !== phaseName) {
        phaseText += `. ${cleanDescription}`;
      }
    }

    return phaseText;
  });

  let result = `${descriptions.join(". ")}.`;

  if (remaining > 0) {
    result += ` Plus ${remaining} more ${pluralize("phase", remaining)}.`;
  }

  return result;
}

/**
 * Format execution information
 */
function formatExecutionInfo(plan: StructuredPlan): string {
  const agentCount = plan.resources.agentCount;
  const waveCount = plan.waves?.length ?? 1;
  const strategy = plan.resources.strategy;

  const parts: string[] = [];

  // Agent and wave info
  if (waveCount > 1) {
    parts.push(
      `This will run ${agentCount} ${pluralize("agent", agentCount)} in ${waveCount} ${pluralize("wave", waveCount)}`
    );
  } else {
    parts.push(`This will run ${agentCount} ${pluralize("agent", agentCount)}`);
  }

  // Strategy hint
  if (strategy === "parallel" && agentCount > 1) {
    parts.push("running in parallel");
  } else if (strategy === "sequential") {
    parts.push("running sequentially");
  }

  return `${parts.join(", ")}.`;
}

/**
 * Format duration estimate if available
 */
function formatDurationEstimate(plan: StructuredPlan): string | null {
  const totalMs = plan.phases.reduce(
    (sum, phase) => sum + phase.estimatedDurationMs,
    0
  );

  if (totalMs <= 0) {
    return null;
  }

  const totalMinutes = Math.ceil(totalMs / 60_000);

  if (totalMinutes < 1) {
    return "Estimated time: under a minute.";
  }

  if (totalMinutes === 1) {
    return "Estimated time: about a minute.";
  }

  if (totalMinutes < 60) {
    return `Estimated time: about ${totalMinutes} minutes.`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `Estimated time: about ${hours} ${pluralize("hour", hours)}.`;
  }

  return `Estimated time: about ${hours} ${pluralize("hour", hours)} and ${minutes} minutes.`;
}

/**
 * Format approval prompt
 */
function formatApprovalPrompt(): string {
  return "Say 'approve' to proceed or 'reject' to cancel.";
}

/**
 * Create a plan summary for status updates
 */
export function planStatusSummary(
  _plan: StructuredPlan,
  completedTasks: number,
  totalTasks: number
): string {
  const percentage = Math.round((completedTasks / totalTasks) * 100);

  if (percentage === 0) {
    return "Execution has just started. No tasks completed yet.";
  }

  if (percentage === 100) {
    return "All tasks have been completed successfully.";
  }

  return `${completedTasks} of ${totalTasks} tasks completed. That's ${percentage}% done.`;
}

/**
 * Create completion summary for voice
 */
export function planCompletionSummary(
  plan: StructuredPlan,
  success: boolean,
  durationMs: number
): string {
  const durationMinutes = Math.round(durationMs / 60_000);
  const taskCount = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);

  if (success) {
    if (durationMinutes < 1) {
      return `Done! Completed ${taskCount} ${pluralize("task", taskCount)} in under a minute.`;
    }
    return `Done! Completed ${taskCount} ${pluralize("task", taskCount)} in ${durationMinutes} ${pluralize("minute", durationMinutes)}.`;
  }

  return "The workflow encountered issues. Some tasks may not have completed successfully. Check the details in the web interface.";
}

/**
 * Clean text for speech synthesis
 */
function cleanForSpeech(text: string): string {
  return (
    text
      // Remove markdown formatting
      .replace(/[*_`#]/g, "")
      // Replace hyphens/underscores with spaces
      .replace(/[-_]/g, " ")
      // Collapse multiple spaces
      .replace(/\s+/g, " ")
      // Remove parenthetical content for brevity
      .replace(/\s*\([^)]*\)/g, "")
      .trim()
  );
}

/**
 * Pluralize a word based on count
 */
function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }

  // Handle irregular plurals
  const irregulars: Record<string, string> = {
    phase: "phases",
    task: "tasks",
    wave: "waves",
    agent: "agents",
    minute: "minutes",
    hour: "hours",
  };

  return irregulars[word] ?? `${word}s`;
}

/**
 * Format clarification questions for voice
 */
export function clarificationToSpeech(
  questions: Array<{ question: string; options?: string[] }>
): string {
  if (questions.length === 0) {
    return "I need more details to create a plan. Can you tell me more about what you want to build?";
  }

  if (questions.length === 1) {
    const q = questions[0];
    if (!q) {
      return "I need a bit more information. Can you provide more details?";
    }

    let response = `Before I create a plan, I need to clarify something. ${q.question}`;

    if (q.options && q.options.length > 0 && q.options.length <= 4) {
      response += ` Your options are: ${q.options.join(", or ")}.`;
    }

    return response;
  }

  const firstQuestion = questions[0];
  if (!firstQuestion) {
    return "I have a few questions before creating the plan. Can you provide more details?";
  }

  return `I have ${questions.length} questions before creating the plan. First: ${firstQuestion.question}`;
}
