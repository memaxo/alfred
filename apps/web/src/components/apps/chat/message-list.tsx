"use client";

/**
 * Message List - Virtualized message rendering
 *
 * Uses windowing for performance with large conversation histories.
 */

import type { AssistantUIMessage } from "@alfred/agent";
import { useCallback, useEffect, useRef } from "react";
import { MessageActions } from "@/components/chat/message-actions";
import { renderPart } from "@/components/chat-render";
import { type AssistantPart, ChatMessage } from "@/components/ui/chat-message";
import { cn } from "@/lib/utils";

type MessageListProps = {
  messages: AssistantUIMessage[];
  onEdit: (id: string, text: string) => void;
  onRegenerate: () => void;
  status: "idle" | "streaming" | "error";
  className?: string;
};

export function MessageList({
  messages,
  onEdit,
  onRegenerate,
  status,
  className,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const renderActions = useCallback(
    (message: AssistantUIMessage, isLast: boolean) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";

      return (
        <MessageActions
          disabled={status === "streaming"}
          onEdit={isUser ? () => onEdit(message.id, "") : undefined}
          onRegenerate={isAssistant && isLast ? onRegenerate : undefined}
          role={message.role}
        />
      );
    },
    [status, onEdit, onRegenerate]
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

  // For now, render all messages without virtualization
  // TODO: Add react-window or @tanstack/virtual for large lists
  return (
    <div className={cn("overflow-y-auto p-4", className)} ref={containerRef}>
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;

        return (
          <ChatMessage
            actions={renderActions(message, isLast)}
            content={message.parts as AssistantPart[]}
            key={message.id}
            renderPart={renderPart}
            role={message.role}
          />
        );
      })}

      {/* Streaming indicator */}
      {status === "streaming" && (
        <div className="flex items-center gap-2 py-2 text-biolum-dim text-sm">
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

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
