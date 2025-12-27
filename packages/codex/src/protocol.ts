/**
 * Protocol schemas for Codex thread events
 *
 * Re-exports from @alfred/protocol for backwards compatibility.
 * New code should import directly from @alfred/protocol.
 */

import { logger } from "@alfred/logger";
import { parseThreadEvent as parseThreadEventBase } from "@alfred/protocol";

// Re-export all types and schemas from @alfred/protocol
export {
  type AgentMessageItem,
  agentMessageItemSchema,
  type CommandExecutionItem,
  commandExecutionItemSchema,
  type ErrorItem,
  errorEventSchema,
  errorItemSchema,
  type FileChangeItem,
  fileChangeItemSchema,
  type ItemCompletedEvent,
  type ItemStartedEvent,
  type ItemUpdatedEvent,
  itemCompletedEventSchema,
  itemStartedEventSchema,
  itemUpdatedEventSchema,
  type McpToolCallItem,
  mcpToolCallItemSchema,
  type ReasoningItem,
  reasoningItemSchema,
  type ThreadErrorEvent,
  type ThreadEvent,
  type ThreadItem,
  type ThreadStartedEvent,
  type TodoListItem,
  type TurnCompletedEvent,
  type TurnFailedEvent,
  type TurnStartedEvent,
  threadEventSchema,
  threadItemSchema,
  threadStartedEventSchema,
  todoListItemSchema,
  turnCompletedEventSchema,
  turnFailedEventSchema,
  turnStartedEventSchema,
  type WebSearchItem,
  webSearchItemSchema,
} from "@alfred/protocol";

/**
 * Parse a thread event with logging for backwards compatibility
 */
export function parseThreadEvent(
  payload: unknown
): ReturnType<typeof parseThreadEventBase> {
  return parseThreadEventBase(payload, {
    onWarning: (message, context) => {
      logger.warn(`codex_${message}`, context);
    },
  });
}
