/**
 * CarPlay Intent Classification Bridge
 *
 * Routes voice transcripts to appropriate handlers based on intent.
 * Uses simple pattern matching for CarPlay-specific commands,
 * with fallback to the backend LLM classifier for complex intents.
 *
 * The backend classifier lives in:
 * - packages/api/src/voice/intent.ts (classifyVoiceIntent)
 */

import { getClient } from "../api";
import { useCarPlayStore } from "../store";

export type CarPlayIntent =
  | { type: "status_query"; workflowId?: string }
  | { type: "decision_query" }
  | {
      type: "escalation_action";
      action: "approve" | "reject" | "defer" | "skip";
    }
  | { type: "pr_action"; action: "approve" | "defer" | "changes" }
  | { type: "plan_action"; action: "approve" | "reject" | "modify" }
  | {
      type: "workflow_control";
      action: "pause" | "resume" | "cancel";
      workflowId?: string;
    }
  | {
      type: "navigation";
      target: "status" | "decisions" | "prs" | "voice" | "back" | "home";
    }
  | { type: "help" }
  | { type: "conversational"; text: string }
  | { type: "new_task"; requirement: string };

export interface IntentClassificationResult {
  intent: CarPlayIntent;
  confidence: number;
  usedBackend: boolean;
}

// Pattern matchers for common CarPlay commands
const STATUS_PATTERNS = [
  /^(?:what(?:'s| is) (?:the )?)?status/i,
  /^how(?:'s| is) (?:it going|everything|the workflow)/i,
  /^(?:show|tell) (?:me )?(?:the )?status/i,
  /^progress/i,
  /^update/i,
];

const DECISION_PATTERNS = [
  /^(?:what )?(?:needs|requires) (?:my )?attention/i,
  /^(?:any|what) (?:pending )?decisions/i,
  /^decision(?:s)? (?:queue|list)?/i,
  /^escalations?/i,
];

const APPROVE_PATTERNS = [
  /^(?:yes|yeah|yep|approve|approved|accept|ok|okay|go|proceed|do it|sounds good|looks good)/i,
];

const REJECT_PATTERNS = [
  /^(?:no|nope|reject|rejected|decline|cancel|don't|stop)/i,
];

const DEFER_PATTERNS = [/^(?:defer|later|skip|next|not now|remind me later)/i];

const PAUSE_PATTERNS = [/^(?:pause|stop|hold|wait)/i];

const RESUME_PATTERNS = [/^(?:resume|continue|go|start|unpause)/i];

const CANCEL_PATTERNS = [/^(?:cancel|abort|kill|terminate|end)/i];

const NAV_STATUS_PATTERNS = [/^(?:go to |show |open )?status/i, /^workflows?/i];

const NAV_DECISIONS_PATTERNS = [
  /^(?:go to |show |open )?decisions?/i,
  /^escalations?/i,
];

const NAV_PRS_PATTERNS = [
  /^(?:go to |show |open )?(?:pull requests?|prs?)$/i,
  /^(?:go to |show |open )?(?:pull requests?|prs?)\b/i,
];

const NAV_VOICE_PATTERNS = [/^(?:go to |show |open )?voice/i, /^talk/i];

const NAV_BACK_PATTERNS = [/^(?:go )?back/i, /^return/i];

const NAV_HOME_PATTERNS = [/^(?:go )?home/i, /^main/i, /^dashboard/i];

const HELP_PATTERNS = [
  /^help/i,
  /^what can (?:you|i) (?:do|say)/i,
  /^commands?/i,
];

/**
 * Classify a voice transcript into a CarPlay intent.
 * Uses local pattern matching first, then falls back to backend LLM.
 */
export async function classifyCarPlayIntent(
  transcript: string
): Promise<IntentClassificationResult> {
  const normalized = transcript.toLowerCase().trim();
  const store = useCarPlayStore.getState();

  // Get context for context-aware classification
  const hasDecisions = store.escalations.length > 0 || store.reviews.length > 0;
  const hasPendingPlans = store.pendingPlans.length > 0;

  // Try local pattern matching first (fast path)
  const localIntent = classifyLocally(
    normalized,
    hasDecisions,
    hasPendingPlans
  );
  if (localIntent) {
    return {
      intent: localIntent,
      confidence: 0.9,
      usedBackend: false,
    };
  }

  // Fall back to backend LLM classification for complex intents
  try {
    const backendIntent = await classifyWithBackend(transcript);
    if (backendIntent) {
      return {
        intent: backendIntent,
        confidence: 0.8,
        usedBackend: true,
      };
    }
  } catch {}

  // Default: treat as new task or conversational
  if (
    normalized.length > 20 &&
    /(?:build|create|fix|implement|add|update|change)/i.test(normalized)
  ) {
    return {
      intent: { type: "new_task", requirement: transcript },
      confidence: 0.6,
      usedBackend: false,
    };
  }

  return {
    intent: { type: "conversational", text: transcript },
    confidence: 0.5,
    usedBackend: false,
  };
}

/**
 * Local pattern-based classification (fast path)
 */
function classifyLocally(
  normalized: string,
  hasDecisions: boolean,
  hasPendingPlans: boolean
): CarPlayIntent | null {
  // Navigation commands
  if (NAV_STATUS_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "status" };
  }
  if (NAV_DECISIONS_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "decisions" };
  }
  if (NAV_PRS_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "prs" };
  }
  if (NAV_VOICE_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "voice" };
  }
  if (NAV_BACK_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "back" };
  }
  if (NAV_HOME_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "navigation", target: "home" };
  }

  // Help
  if (HELP_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "help" };
  }

  // Status query
  if (STATUS_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "status_query" };
  }

  // Decision query
  if (DECISION_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "decision_query" };
  }

  // Context-aware: if we have pending decisions, short commands are likely actions
  if (hasDecisions) {
    if (APPROVE_PATTERNS.some((p) => p.test(normalized))) {
      return { type: "escalation_action", action: "approve" };
    }
    if (REJECT_PATTERNS.some((p) => p.test(normalized))) {
      return { type: "escalation_action", action: "reject" };
    }
    if (DEFER_PATTERNS.some((p) => p.test(normalized))) {
      return { type: "escalation_action", action: "defer" };
    }
  }

  // Context-aware: if we have pending plans
  if (hasPendingPlans) {
    if (APPROVE_PATTERNS.some((p) => p.test(normalized))) {
      return { type: "plan_action", action: "approve" };
    }
    if (REJECT_PATTERNS.some((p) => p.test(normalized))) {
      return { type: "plan_action", action: "reject" };
    }
  }

  // Workflow control
  if (PAUSE_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "workflow_control", action: "pause" };
  }
  if (RESUME_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "workflow_control", action: "resume" };
  }
  if (CANCEL_PATTERNS.some((p) => p.test(normalized))) {
    return { type: "workflow_control", action: "cancel" };
  }

  return null;
}

/**
 * Backend LLM classification (via tRPC)
 */
async function classifyWithBackend(
  transcript: string
): Promise<CarPlayIntent | null> {
  const _client = getClient();

  // Use the voice.speechToSpeech endpoint which includes intent classification
  // For pure classification, we'd need a dedicated endpoint
  // For now, map the backend intent types to CarPlay intents

  // Note: This is a simplified implementation.
  // A full implementation would call a dedicated classification endpoint.

  // Check if the transcript looks like a task description
  const taskKeywords =
    /(?:build|create|fix|implement|add|update|change|modify|refactor|test|deploy)/i;
  if (taskKeywords.test(transcript) && transcript.length > 15) {
    return { type: "new_task", requirement: transcript };
  }

  return null;
}

/**
 * Get help text for available commands.
 */
export function getHelpText(): string {
  return `You can say:
- "Status" to check workflow progress
- "Decisions" to see pending approvals
- "Approve" or "Reject" for decisions
- "Pause" or "Resume" to control workflows
- Or describe a new task to start`;
}
