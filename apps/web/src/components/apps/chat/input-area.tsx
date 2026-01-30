/**
 * Input Area - Text and voice input for chat
 */

import { logger } from "@alfred/logger";
import { Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { type KeyboardEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InputAreaProps {
  onSubmit: (text: string) => void;
  onVoiceToggle: () => void;
  isRecording: boolean;
  disabled?: boolean;
  error?: Error | null;
  className?: string;
}

export function InputArea({
  onSubmit,
  onVoiceToggle,
  isRecording,
  disabled,
  error,
  className,
}: InputAreaProps) {
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      setInput("");
      // Defer submission to allow event processing to complete.
      setTimeout(() => {
        try {
          onSubmit(trimmed);
        } catch (error) {
          logger.error("chat_submit_failed", { error });
        }
      }, 0);
    }
  }, [input, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleVoiceToggle = useCallback(() => {
    try {
      onVoiceToggle();
    } catch (error) {
      logger.error("chat_voice_toggle_failed", { error });
    }
  }, [onVoiceToggle]);

  return (
    <div className={cn("border-white/5 border-t", className)}>
      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 px-3 py-2 text-red-400 text-xs">
          {error.message}
        </div>
      )}

      {/* Input container */}
      <div className="p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          {/* Attachment button */}
          <Button
            className="h-8 w-8 flex-shrink-0"
            disabled={disabled}
            size="icon"
            variant="ghost"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Text input */}
          <Textarea
            className="max-h-[200px] min-h-[40px] flex-1 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0"
            disabled={disabled}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening..." : "Type a message..."}
            rows={1}
            value={input}
          />

          {/* Voice button */}
          <Button
            className={cn(
              "h-8 w-8 flex-shrink-0",
              isRecording && "bg-red-500/20 text-red-400"
            )}
            disabled={disabled}
            onClick={handleVoiceToggle}
            size="icon"
            variant="ghost"
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Send button */}
          <Button
            className="h-8 w-8 flex-shrink-0"
            disabled={disabled || !input.trim()}
            onClick={handleSubmit}
            size="icon"
            variant="ghost"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick actions */}
        <div className="mt-2 flex items-center gap-2">
          <Button
            className="h-6 gap-1 text-xs"
            disabled={disabled}
            size="sm"
            variant="ghost"
          >
            <Sparkles className="h-3 w-3" />
            Suggest
          </Button>
        </div>
      </div>
    </div>
  );
}
