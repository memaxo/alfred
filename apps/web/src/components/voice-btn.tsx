/**
 * Voice Button Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/voice-button
 * Large touch-friendly voice control button for drive mode
 */

import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      aria-pressed={isRecording}
      className={cn("rounded-full shadow-lg", sizeConfig[size], className)}
      onClick={onToggle}
      role="switch"
      size="icon"
      variant={isRecording ? "destructive" : "default"}
    >
      {isRecording ? (
        <Square aria-hidden="true" className="size-8" />
      ) : (
        <Mic aria-hidden="true" className="size-8" />
      )}
    </Button>
  );
}
