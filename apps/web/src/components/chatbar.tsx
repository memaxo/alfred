/**
 * Conversation Bar Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/conversation-bar
 * Input bar for chat with voice support
 * 
 * Carmack-Karpathy principles:
 * - Fast failure: validate early
 * - Single responsibility: input handling only
 * - No allocations: stable callbacks
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, memo } from "react";

interface ChatbarProps {
  onSend: (message: string) => void;
  onVoice?: () => void;
  placeholder?: string;
  className?: string;
}

function ChatbarInner({
  onSend,
  onVoice,
  placeholder = "Type a message...",
  className,
}: ChatbarProps) {
  const [message, setMessage] = useState("");

  // Stable callback: no recreations
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed) {
      onSend(trimmed);
      setMessage("");
    }
  }, [message, onSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex items-center gap-2", className)}
    >
      <Input
        value={message}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1"
        aria-label="Message input"
      />
      {onVoice && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onVoice}
          aria-label="Voice input"
        >
          <Mic className="size-4" />
        </Button>
      )}
      <Button type="submit" size="icon" aria-label="Send message">
        <Send className="size-4" />
      </Button>
    </form>
  );
}

// Memoize: pure component
export const Chatbar = memo(ChatbarInner);

