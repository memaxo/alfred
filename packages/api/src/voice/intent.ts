/**
 * Voice intent classification for routing voice input to appropriate handlers.
 *
 * Uses LLM-first classification via @alfred/plan/classify with keyword fallback.
 * Context-aware: detects approval commands when a plan is awaiting approval.
 *
 * @see .ruler/55-llm-first-classification.md
 */

import { logger } from "@alfred/logger";
import { z } from "zod";
import type { VoiceWorkflowContext } from "./workflow-state.js";

/**
 * Voice intent classification result types
 */
export type VoiceIntentResult =
  | { type: "workflow"; confidence: number; requirement: string }
  | { type: "approval"; action: "approve" | "reject" }
  | { type: "status_query"; runId?: string }
  | { type: "conversational" };

/**
 * Schema for LLM classification output
 */
const voiceIntentSchema = z.object({
  intent: z.enum(["workflow", "approval", "status", "conversational"]),
  confidence: z.number().min(0).max(1),
  approvalAction: z.enum(["approve", "reject"]).optional(),
  workflowRequirement: z.string().optional(),
});

/**
 * Workflow intent keywords for heuristic fallback
 */
const WORKFLOW_KEYWORDS = [
  "build",
  "create",
  "implement",
  "add",
  "fix",
  "refactor",
  "update",
  "change",
  "modify",
  "write",
  "develop",
  "make",
  "setup",
  "configure",
  "deploy",
  "migrate",
  "upgrade",
  "integrate",
  "connect",
  "enable",
  "feature",
  "bug",
  "issue",
  "component",
  "module",
  "service",
  "endpoint",
  "api",
  "database",
  "schema",
  "test",
  "tests",
];

/**
 * Approval intent keywords
 */
const APPROVAL_KEYWORDS = [
  "approve",
  "approved",
  "yes",
  "yeah",
  "yep",
  "go ahead",
  "proceed",
  "do it",
  "execute",
  "run it",
  "start",
  "begin",
  "let's go",
  "sounds good",
  "looks good",
  "that's fine",
  "ok",
  "okay",
];

const REJECTION_KEYWORDS = [
  "reject",
  "rejected",
  "no",
  "nope",
  "cancel",
  "stop",
  "don't",
  "abort",
  "nevermind",
  "never mind",
  "forget it",
  "scratch that",
  "not now",
  "hold on",
  "wait",
];

/**
 * Status query keywords
 */
const STATUS_KEYWORDS = [
  "status",
  "progress",
  "how's it going",
  "update",
  "what's happening",
  "are you done",
  "is it done",
  "finished",
  "complete",
  "how far",
];

/**
 * Classify voice intent using LLM with heuristic fallback.
 *
 * Context-aware classification:
 * - If awaiting approval, prioritize approval/rejection detection
 * - If executing, prioritize status queries
 * - Otherwise, detect workflow vs conversational intent
 */
export async function classifyVoiceIntent(
  transcript: string,
  sessionContext?: VoiceWorkflowContext
): Promise<VoiceIntentResult> {
  const normalized = transcript.toLowerCase().trim();

  // Fast path: if awaiting approval, check for approval/rejection first
  if (sessionContext?.state.phase === "awaiting_approval") {
    const approvalResult = detectApprovalIntent(normalized);
    if (approvalResult) {
      return approvalResult;
    }
  }

  // Fast path: if executing, check for status queries
  if (
    sessionContext?.state.phase === "executing" &&
    isStatusQuery(normalized)
  ) {
    const runId =
      sessionContext.state.phase === "executing"
        ? sessionContext.state.runId
        : undefined;
    return { type: "status_query", runId };
  }

  // Try LLM classification
  try {
    const llmResult = await classifyWithLLM(transcript, sessionContext);
    if (llmResult) {
      return llmResult;
    }
  } catch (error) {
    logger.warn("voice_intent_llm_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback to heuristic classification
  return classifyWithHeuristics(normalized);
}

/**
 * LLM-based intent classification
 */
async function classifyWithLLM(
  transcript: string,
  sessionContext?: VoiceWorkflowContext
): Promise<VoiceIntentResult | null> {
  // Dynamic import to avoid circular dependency
  const [{ classify, OFFLINE_MODE }, { getClassificationModel }] =
    await Promise.all([
      import("@alfred/plan/classify"),
      import("@alfred/agent/selector"),
    ]);

  // Skip LLM in offline mode
  if (OFFLINE_MODE) {
    return null;
  }

  const contextHint = sessionContext?.state.phase
    ? `Current state: ${sessionContext.state.phase}. `
    : "";

  const prompt = `${contextHint}Classify this voice input into one of four categories:
- "workflow": User wants to create, build, fix, or modify something (a coding/development task)
- "approval": User is approving or rejecting a previously presented plan
- "status": User is asking about progress or status of an ongoing task
- "conversational": General conversation, questions, or anything else

Voice input: "${transcript}"

If the intent is "workflow", extract the requirement from the user's words.
If the intent is "approval", determine if it's an "approve" or "reject" action.
Provide a confidence score from 0 to 1.`;

  const selection = getClassificationModel();

  const result = await classify(voiceIntentSchema, prompt, {
    model: selection.model,
    modelKey: selection.modelKey,
    metricType: "intent",
    fallback: () => ({
      intent: "conversational" as const,
      confidence: 0.5,
    }),
  });

  const { intent, confidence, approvalAction, workflowRequirement } =
    result.result;

  switch (intent) {
    case "workflow":
      return {
        type: "workflow",
        confidence,
        requirement: workflowRequirement ?? transcript,
      };
    case "approval":
      return {
        type: "approval",
        action: approvalAction ?? "approve",
      };
    case "status":
      return {
        type: "status_query",
        runId:
          sessionContext?.state.phase === "executing"
            ? sessionContext.state.runId
            : undefined,
      };
    default:
      return { type: "conversational" };
  }
}

/**
 * Detect approval or rejection intent from transcript
 */
function detectApprovalIntent(normalized: string): VoiceIntentResult | null {
  // Check rejection first (more specific)
  for (const keyword of REJECTION_KEYWORDS) {
    if (
      normalized === keyword ||
      normalized.startsWith(`${keyword} `) ||
      normalized.includes(` ${keyword}`)
    ) {
      return { type: "approval", action: "reject" };
    }
  }

  // Check approval
  for (const keyword of APPROVAL_KEYWORDS) {
    if (
      normalized === keyword ||
      normalized.startsWith(`${keyword} `) ||
      normalized.includes(` ${keyword}`)
    ) {
      return { type: "approval", action: "approve" };
    }
  }

  return null;
}

/**
 * Check if transcript is a status query
 */
function isStatusQuery(normalized: string): boolean {
  return STATUS_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword)
  );
}

/**
 * Heuristic-based intent classification fallback
 */
function classifyWithHeuristics(normalized: string): VoiceIntentResult {
  // Check for status query
  if (isStatusQuery(normalized)) {
    return { type: "status_query" };
  }

  // Check for workflow keywords
  // Threshold of 0.5 means: starting with a workflow keyword OR having 1+ keyword
  const workflowScore = calculateWorkflowScore(normalized);
  if (workflowScore >= 0.5) {
    return {
      type: "workflow",
      confidence: workflowScore,
      requirement: normalized,
    };
  }

  // Default to conversational
  return { type: "conversational" };
}

/**
 * Calculate workflow intent score based on keyword matching
 */
function calculateWorkflowScore(normalized: string): number {
  const words = normalized.split(/\s+/);
  let matchCount = 0;

  for (const word of words) {
    if (WORKFLOW_KEYWORDS.includes(word)) {
      matchCount++;
    }
  }

  // Strong boost if the sentence starts with a workflow keyword (imperative command)
  const firstWord = words[0];
  if (firstWord && WORKFLOW_KEYWORDS.includes(firstWord)) {
    matchCount += 1.0;
  }

  // Calculate score: more matches = higher confidence
  // Max out at 1.0 for 2+ keyword matches (adjusted for voice UX)
  return Math.min(1.0, matchCount / 2);
}

/**
 * Export for testing
 */
export const _internal = {
  detectApprovalIntent,
  isStatusQuery,
  classifyWithHeuristics,
  calculateWorkflowScore,
  WORKFLOW_KEYWORDS,
  APPROVAL_KEYWORDS,
  REJECTION_KEYWORDS,
  STATUS_KEYWORDS,
};
