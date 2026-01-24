/**
 * Voice intent classification for routing voice input to appropriate handlers.
 *
 * Uses LLM-first classification via @alfred/plan/classify with a minimal,
 * state-gated heuristic fallback for unambiguous approval/rejection only.
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

export type VoiceIntentMeta = {
  heuristicFallbackUsed: boolean;
};

export type VoiceIntentClassified = {
  result: VoiceIntentResult;
  meta: VoiceIntentMeta;
};

/**
 * Schema for LLM classification output
 */
const voiceIntentSchema = z.object({
  intent: z.enum(["workflow", "approval", "status", "conversational"]),
  confidence: z.number().min(0).max(1),
  approvalAction: z.enum(["approve", "reject"]).optional(),
  workflowRequirement: z.string().optional(),
});

const APPROVE_FALLBACK = new Set(["approve", "approved", "yes", "yep", "yeah"]);
const REJECT_FALLBACK = new Set(["reject", "rejected", "no", "nope", "cancel"]);

/**
 * Classify voice intent using LLM with heuristic fallback.
 *
 * Context-aware classification:
 * - If awaiting approval, prioritize approval/rejection detection
 * - Otherwise, defer to LLM classification (or degrade safely if unavailable)
 */
export async function classifyVoiceIntent(
  transcript: string,
  sessionContext?: VoiceWorkflowContext
): Promise<VoiceIntentClassified> {
  const normalized = transcript.toLowerCase().trim();

  // Minimal heuristic fallback: only for unambiguous approve/reject in awaiting_approval.
  if (sessionContext?.state.phase === "awaiting_approval") {
    const approval = detectApprovalFallback(normalized);
    if (approval) {
      return { result: approval, meta: { heuristicFallbackUsed: true } };
    }
  }

  // Try LLM classification
  try {
    const llmResult = await classifyWithLLM(transcript, sessionContext);
    if (llmResult) {
      return { result: llmResult, meta: { heuristicFallbackUsed: false } };
    }
  } catch (error) {
    logger.warn("voice_intent_llm_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Safe degradation: do not guess with keyword forests.
  return {
    result: { type: "conversational" },
    meta: { heuristicFallbackUsed: false },
  };
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
 * Minimal approval/rejection fallback for awaiting_approval.
 */
function detectApprovalFallback(normalized: string): VoiceIntentResult | null {
  if (REJECT_FALLBACK.has(normalized)) {
    return { type: "approval", action: "reject" };
  }
  if (APPROVE_FALLBACK.has(normalized)) {
    return { type: "approval", action: "approve" };
  }
  return null;
}

/**
 * Export for testing
 */
export const _internal = {
  detectApprovalFallback,
};
