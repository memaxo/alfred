/**
 * @deprecated
 * This module previously hosted runtime-backed workflow helper utilities.
 *
 * Canonical workflow execution is now **pipeline-backed** via `@alfred/pipeline`,
 * and the canonical helpers live in `@alfred/agent/workflow/services`.
 */

export {
  coerceRecord,
  createRequirementMessage,
  deriveWorkflowTitle,
  ensureObligations,
  ensureUuid,
  ensureWorkflowConversation,
  persistWorkflowMessages,
  stableUuidFromSeed,
} from "@alfred/agent/workflow/services";
