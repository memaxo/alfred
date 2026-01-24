import { cn } from "@/lib/utils";

import { Load } from "./load";
import { Orb } from "./orb";
import { VoiceBtn } from "./voice-btn";

type DriveModeProps = {
  transcript: string;
  reply: string;
  error?: string | null;
  isRecording: boolean;
  isProcessing: boolean;
  onToggle: () => void;
  onComplete: () => void;
  className?: string;
};

function getAgentState(
  status: string
): "idle" | "thinking" | "speaking" | "listening" {
  if (status === "listening") {
    return "listening";
  }
  if (status === "thinking") {
    return "thinking";
  }
  return "idle";
}

function getStatus(isRecording: boolean, isProcessing: boolean) {
  if (isRecording) {
    return "listening";
  }
  if (isProcessing) {
    return "thinking";
  }
  return "idle";
}

export function DriveMode({
  transcript,
  reply,
  error,
  isRecording,
  isProcessing,
  onToggle,
  onComplete,
  className,
}: DriveModeProps) {
  const status = getStatus(isRecording, isProcessing);

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center space-y-6 p-8",
        className
      )}
    >
      <div className="space-y-2 text-center">
        <h2 className="font-bold text-2xl">Drive Mode</h2>
        <p className="text-muted-foreground">
          Tap and speak. Keep eyes forward.
        </p>
      </div>

      <Orb className="h-64 w-64" status={getAgentState(status)} />

      {isProcessing && <Load message="Processing your request..." />}

      <VoiceBtn isRecording={isRecording} onToggle={onToggle} size="lg" />

      <div className="w-full max-w-md space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left">
        {transcript && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              You said
            </p>
            <p className="font-medium text-sm">{transcript}</p>
          </div>
        )}
        {reply && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Alfred
            </p>
            <p className="text-sm">{reply}</p>
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive text-sm">
            {error}
          </div>
        )}
        {!(transcript || reply || error) && (
          <p className="text-muted-foreground text-sm">
            Hold the button, speak a short command (&lt;10s), release to send.
          </p>
        )}
      </div>

      <button
        aria-label="Exit drive mode"
        className="rounded-lg border px-6 py-3 font-medium text-sm hover:bg-accent"
        onClick={onComplete}
        type="button"
      >
        Exit Drive Mode
      </button>
    </div>
  );
}
