/**
 * Message List - Virtualized message rendering
 *
 * Uses windowing for performance with large conversation histories.
 */

import type { UIMessage } from "@alfred/type/stream";

import { useCallback } from "react";
import { Virtuoso } from "react-virtuoso";

import { renderPart } from "@/components/chat-render";
import { EditMessage } from "@/components/chat/edit-message";
import { MessageActions } from "@/components/chat/message-actions";
import { type AssistantPart, ChatMessage } from "@/components/ui/chat-message";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { cn } from "@/lib/utils";

type AssistantUIMessage = UIMessage;

interface MessageListProps {
  messages: AssistantUIMessage[];
  onEdit: (id: string, text: string) => void;
  onRegenerate: () => void;
  status: "idle" | "streaming" | "error";
  className?: string;
}

interface MessageItemProps {
  message: AssistantUIMessage;
  isEditing: boolean;
  isLast: boolean;
  status: MessageListProps["status"];
  onCancel: () => void;
  onSave: (messageId: string, newText: string) => void;
  renderActions: (message: AssistantUIMessage, isLast: boolean) => JSX.Element;
  resolveText: (message: AssistantUIMessage) => string;
}

function MessageItem({
  message,
  isEditing,
  isLast,
  status,
  onCancel,
  onSave,
  renderActions,
  resolveText,
}: MessageItemProps) {
  const handleSave = useCallback(
    (newText: string) => {
      onSave(message.id, newText);
    },
    [message.id, onSave]
  );

  return (
    <div className="p-4">
      {isEditing && message.role === "user" ? (
        <EditMessage
          disabled={status === "streaming"}
          initialText={resolveText(message)}
          onCancel={onCancel}
          onSave={handleSave}
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

  const handleRegenerate = useCallback(
    (_message: AssistantUIMessage) => {
      onRegenerate?.();
    },
    [onRegenerate]
  );

  const renderActions = useCallback(
    (message: AssistantUIMessage, isLast: boolean) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";

      return (
        <MessageActions
          disabled={status === "streaming"}
          message={message}
          onEdit={isUser ? startEditing : undefined}
          onRegenerate={isAssistant && isLast ? handleRegenerate : undefined}
          role={message.role}
        />
      );
    },
    [status, handleRegenerate, startEditing]
  );

  const handleSaveEdit = useCallback(
    (messageId: string, newText: string) => {
      onEdit(messageId, newText);
      cancelEditing();
    },
    [onEdit, cancelEditing]
  );

  const renderItem = useCallback(
    (index: number, message: AssistantUIMessage) => {
      const isLast = index === messages.length - 1;
      const isEditingCurrent = isEditing(message.id);

      return (
        <MessageItem
          isEditing={isEditingCurrent}
          isLast={isLast}
          message={message}
          onCancel={cancelEditing}
          onSave={handleSaveEdit}
          renderActions={renderActions}
          resolveText={handleMessageText}
          status={status}
        />
      );
    },
    [
      cancelEditing,
      handleMessageText,
      handleSaveEdit,
      isEditing,
      messages.length,
      renderActions,
      status,
    ]
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
        itemContent={renderItem}
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
