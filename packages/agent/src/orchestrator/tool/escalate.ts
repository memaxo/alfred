/**
 * Escalate Tool
 *
 * Enables agents to signal environment blockers requiring re-planning.
 * This provides real-time escalation detection via the writer stream,
 * replacing the deprecated file-based escalation mechanism.
 */

import { z } from "zod";

import {
  AGENT_ESCALATION_REASONS,
  type AgentEscalationEvent,
  type AgentEscalationReason,
  type ToolExecuteContext,
} from "./shared/context.js";

/**
 * Custom error thrown when an agent escalates.
 * This terminates agent execution cleanly.
 */
export class EscalationError extends Error {
  readonly reason: AgentEscalationReason;
  readonly details: string;
  readonly suggestions?: string[];
  readonly severity: "warning" | "blocking";

  constructor(
    reason: AgentEscalationReason,
    details: string,
    suggestions?: string[],
    severity: "warning" | "blocking" = "blocking"
  ) {
    super(`Agent escalation: ${reason} - ${details}`);
    this.name = "EscalationError";
    this.reason = reason;
    this.details = details;
    this.suggestions = suggestions;
    this.severity = severity;
  }
}

/**
 * Type guard for EscalationError
 */
export function isEscalationError(error: unknown): error is EscalationError {
  return error instanceof EscalationError;
}

const escalateInputSchema = z.object({
  reason: z.enum([
    AGENT_ESCALATION_REASONS.MISSING_DEPENDENCY,
    AGENT_ESCALATION_REASONS.WRONG_ARCHITECTURE,
    AGENT_ESCALATION_REASONS.PERMISSION_DENIED,
    AGENT_ESCALATION_REASONS.RESOURCE_EXHAUSTED,
    AGENT_ESCALATION_REASONS.EXTERNAL_SERVICE_UNAVAILABLE,
    AGENT_ESCALATION_REASONS.CONFLICTING_REQUIREMENTS,
    AGENT_ESCALATION_REASONS.OTHER,
  ]),
  details: z
    .string()
    .min(10, "Details must be at least 10 characters")
    .max(2000, "Details must not exceed 2000 characters"),
  suggestions: z
    .array(z.string().max(500))
    .max(5)
    .optional()
    .describe("Optional suggestions for how to resolve the blocker"),
  severity: z
    .enum(["warning", "blocking"])
    .default("blocking")
    .describe(
      "warning: agent can continue but needs attention; blocking: requires immediate response"
    ),
});

type EscalateInput = z.infer<typeof escalateInputSchema>;

const escalateOutputSchema = z.object({
  escalated: z.literal(true),
  reason: z.string(),
  details: z.string(),
  severity: z.enum(["warning", "blocking"]),
});

/**
 * Escalate tool for agents to signal environment blockers.
 *
 * Usage in agent prompt:
 * "If you encounter a blocking issue (missing dependency, wrong architecture, etc.),
 *  use the escalate tool with the reason and details."
 *
 * This tool:
 * 1. Emits a real-time escalation event via writer.write()
 * 2. Throws EscalationError to terminate agent execution
 *
 * The orchestrator intercepts the escalation event and can:
 * - Abort the current agent immediately
 * - Trigger re-planning with escalation context
 * - Notify human operators
 */
export const toolEscalate = {
  name: "escalate",
  description:
    "Signal an environment blocker that requires re-planning or human intervention. " +
    "Use this when you encounter issues like missing dependencies, wrong architecture, " +
    "permission errors, or other blockers that cannot be resolved within current task scope.",
  inputSchema: escalateInputSchema,
  outputSchema: escalateOutputSchema,
  execute: async ({
    input,
    writer,
  }: ToolExecuteContext<EscalateInput>): Promise<never> => {
    // Emit escalation event for real-time detection
    const event: AgentEscalationEvent = {
      type: "escalate",
      reason: input.reason,
      details: input.details,
      suggestions: input.suggestions,
      severity: input.severity,
    };

    // Write to stream for real-time interception by orchestrator
    await writer?.write?.(event);

    // Throw to terminate agent execution
    throw new EscalationError(
      input.reason,
      input.details,
      input.suggestions,
      input.severity
    );
  },
};

export type ToolEscalate = typeof toolEscalate;
