/**
 * Message List - Virtualized message rendering
 *
 * Uses windowing for performance with large conversation histories.
 */

import type { UIMessage } from "@alfred/type/stream";

type AssistantUIMessage = UIMessage;

import { useCallback } from "react";
import { Virtuoso } from "react-virtuoso";

import { renderPart } from "@/components/chat-render";
import { EditMessage } from "@/components/chat/edit-message";
import { MessageActions } from "@/components/chat/message-actions";
import { type AssistantPart, ChatMessage } from "@/components/ui/chat-message";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: AssistantUIMessage[];
  onEdit: (id: string, text: string) => void;
  onRegenerate: () => void;
  status: "idle" | "streaming" | "error";
  className?: string;
}

export function MessageList({
  messages,
  onEdit,
  onRegenerate,
  status,
  className,
}: MessageListProps) {
  const { isEditing, startEditing, cancelEditing } = useMessageEdit({
    handleEdit: onEdit,
  });

  const handleMessageText = useCallback((message: AssistantUIMessage) => {
    const textPart = message.parts.find((p) => p.type === "text");
    return textPart && "text" in textPart ? textPart.text : "";
  }, []);

  const renderActions = useCallback(
    (message: AssistantUIMessage, isLast: boolean) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";

      return (
        <MessageActions
          disabled={status === "streaming"}
          onEdit={isUser ? () => startEditing(message) : undefined}
          onRegenerate={isAssistant && isLast ? onRegenerate : undefined}
          role={message.role}
        />
      );
    },
    [status, onRegenerate, startEditing]
  );

  const handleSaveEdit = useCallback(
    (messageId: string, newText: string) => {
      onEdit(messageId, newText);
      cancelEditing();
    },
    [onEdit, cancelEditing]
  );

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="text-center text-biolum-dim">
          <div className="mb-4 text-4xl">💬</div>
          <p className="font-medium text-lg">Start a conversation</p>
          <p className="mt-1 text-sm opacity-70">
            Type a message or use voice input
          </p>
        </div>
      </div>
    );
  }

  // Use Virtuoso for virtualization with large message lists
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <Virtuoso
        className="flex-1"
        data={messages}
        followOutput="smooth"
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        itemContent={(index, message) => {
          const isLast = index === messages.length - 1;
          const isEditingCurrent = isEditing(message.id);

          return (
            <div className="p-4">
              {isEditingCurrent && message.role === "user" ? (
                <EditMessage
                  disabled={status === "streaming"}
                  initialText={handleMessageText(message)}
                  onCancel={cancelEditing}
                  onSave={(newText) => handleSaveEdit(message.id, newText)}
                />
              ) : (
                <ChatMessage
                  actions={renderActions(message, isLast)}
                  content={message.parts as AssistantPart[]}
                  key={message.id}
                  renderPart={renderPart}
                  role={message.role}
                />
              )}
            </div>
          );
        }}
      />
      {/* Streaming indicator */}
      {status === "streaming" && (
        <div className="flex items-center gap-2 border-white/5 border-t bg-void-surface/40 px-4 py-2 text-biolum-dim text-sm">
          <div className="flex gap-1">
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-biolum/50"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-biolum/50"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-biolum/50"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span>Thinking...</span>
        </div>
      )}
    </div>
  );
}
