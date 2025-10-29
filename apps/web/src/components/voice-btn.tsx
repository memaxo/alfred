/**
 * Voice Button Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/voice-button
 * Large touch-friendly voice control button for drive mode
 */

import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceBtnProps {
  isRecording: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function VoiceBtn({
  isRecording,
  onToggle,
  size = "md",
  className,
}: VoiceBtnProps) {
  const sizeConfig = {
    sm: "size-16",
    md: "size-24",
    lg: "size-32",
  };

  return (
    <Button
      variant={isRecording ? "destructive" : "default"}
      size="icon"
      onClick={onToggle}
      className={cn(
        "rounded-full shadow-lg",
        sizeConfig[size],
        className,
      )}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      aria-pressed={isRecording}
      role="switch"
    >
      {isRecording ? (
        <Square className="size-8" aria-hidden="true" />
      ) : (
        <Mic className="size-8" aria-hidden="true" />
      )}
    </Button>
  );
}

