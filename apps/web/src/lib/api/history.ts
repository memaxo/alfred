import { limitUiMessages } from "@alfred/type/history";
import {
  convertToModelMessages,
  type ModelMessage,
  pruneMessages,
  type UIMessage,
} from "ai";

export function pruneMessagesForStream(messages: UIMessage[]): {
  uiMessages: UIMessage[];
  modelMessages: ModelMessage[];
  dropped: number;
} {
  const trimmed = limitUiMessages(messages);
  const modelMessages = convertToModelMessages(trimmed);
  const pruned = pruneMessages({
    messages: modelMessages,
    reasoning: "before-last-message",
    toolCalls: "before-last-2-messages",
    emptyMessages: "remove",
  });
  return {
    uiMessages: trimmed,
    modelMessages: pruned,
    dropped: messages.length - trimmed.length,
  };
}
