/**
 * Form Submission Service
 *
 * Handles form submissions by injecting them as tool-result parts
 * into conversations.
 */

import { randomUUID } from "node:crypto";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { logger } from "@alfred/logger";
import type { UIMessage } from "@alfred/type/stream";

type FormSubmission = {
  userId: string;
  conversationId: string;
  formId: string;
  toolCallId?: string;
  data: Record<string, unknown>;
  schema?: unknown;
};

/**
 * Inject a form submission as a tool-result part into a conversation.
 *
 * @param submission - Form submission data
 */
export async function inject(submission: FormSubmission): Promise<void> {
  const { userId, conversationId, formId, toolCallId, data, schema } =
    submission;

  // Create tool-result part from form submission
  // Match AI SDK v6 tool-result format: { type, toolCallId, toolName, output }
  const toolResultPart = {
    type: "tool-result" as const,
    toolCallId: toolCallId ?? `form-${formId}-${randomUUID()}`,
    toolName: `form_${formId}`,
    output: {
      formId,
      data,
      submittedAt: new Date().toISOString(),
      // Include schema for form schema persistence (Gap 2 requirement)
      ...(schema ? { schema } : {}),
    },
  } as unknown as UIMessage["parts"][number];

  // Create assistant message with tool-result part
  const message: UIMessage = {
    id: randomUUID(),
    role: "assistant",
    parts: [toolResultPart],
  };

  try {
    await conversationRepo.createMessage(userId, conversationId, message);
    logger.info("form_submission_injected", {
      userId,
      conversationId,
      formId,
      toolCallId,
    });
  } catch (error) {
    logger.error("form_submission_injection_failed", {
      userId,
      conversationId,
      formId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
