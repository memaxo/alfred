/**
 * Conversation Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/conversation
 * Main chat interface composed of Msg + Chatbar
 * 
 * Carmack-Karpathy principles:
 * - Composition: Chat = Msg[] + Chatbar
 * - Null safety: handles empty states gracefully
 * - Pure function: no side effects
 */

import { Msg } from "./msg";
import { Chatbar } from "./chatbar";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "orchestrator";
  content: string;
  timestamp: Date;
}

interface ChatProps {
  messages: Message[];
  onSend: (message: string) => void;
  onVoice?: () => void;
  placeholder?: string;
  className?: string;
}

function ChatInner({ messages, onSend, onVoice, placeholder, className }: ChatProps) {
  // Null safety: handle empty state
  if (!messages || messages.length === 0) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No messages yet</p>
        </div>
        <Chatbar onSend={onSend} onVoice={onVoice} placeholder={placeholder} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 overflow-auto space-y-4 p-4">
        {messages.map((message) => (
          <Msg
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}
      </div>
      <div className="p-4 border-t">
        <Chatbar onSend={onSend} onVoice={onVoice} placeholder={placeholder} />
      </div>
    </div>
  );
}

// Memoize for performance: pure component with stable props
export const Chat = memo(ChatInner, (prev, next) => {
  if (prev.messages.length !== next.messages.length) {
    return false;
  }
  for (let index = 0; index < prev.messages.length; index += 1) {
    const prevMsg = prev.messages[index];
    const nextMsg = next.messages[index];
    if (!nextMsg) {
      return false;
    }
    if (
      prevMsg.id !== nextMsg.id ||
      prevMsg.content !== nextMsg.content ||
      prevMsg.role !== nextMsg.role ||
      prevMsg.timestamp.getTime() !== nextMsg.timestamp.getTime()
    ) {
      return false;
    }
  }
  return true;
});
