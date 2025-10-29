/**
 * Drive Mode Component
 * 
 * Large touch targets and voice-first UI for safe driving
 * 
 * Carmack-Karpathy principles:
 * - Fast failure: minimal touch targets
 * - Single responsibility: drive mode only
 * - Clear feedback: haptic and visual
 */

import { VoiceBtn } from "./voice-btn";
import { Orb } from "./orb";
import { Load } from "./load";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DriveModeProps {
  onTranscript: (text: string) => void;
  onComplete: () => void;
  className?: string;
}

export function DriveMode({ onTranscript, onComplete, className }: DriveModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVoiceToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      // TODO: Wire to actual voice capture
      setTimeout(() => {
        setIsProcessing(false);
        onTranscript("Drive mode demo transcription");
      }, 2000);
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8 space-y-8",
        className,
      )}
    >
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold">Drive Mode</h2>
        <p className="text-muted-foreground">
          Tap to speak. Keep your eyes on the road.
        </p>
      </div>

      <Orb
        status={isRecording ? "listening" : isProcessing ? "thinking" : "idle"}
      />

      {isProcessing && (
        <Load message="Processing your request..." />
      )}

      <VoiceBtn
        isRecording={isRecording}
        onToggle={handleVoiceToggle}
        size="lg"
      />

      <button
        onClick={onComplete}
        className="px-6 py-3 text-sm font-medium border rounded-lg hover:bg-accent"
        aria-label="Exit drive mode"
      >
        Exit Drive Mode
      </button>
    </div>
  );
}

