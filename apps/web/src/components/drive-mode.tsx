import { VoiceBtn } from "./voice-btn";
import { Orb } from "./orb";
import { Load } from "./load";
import { cn } from "@/lib/utils";

interface DriveModeProps {
  transcript: string;
  reply: string;
  error?: string | null;
  isRecording: boolean;
  isProcessing: boolean;
  onToggle: () => void;
  onComplete: () => void;
  className?: string;
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
  const status = isRecording ? "listening" : isProcessing ? "thinking" : "idle";

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center space-y-6 p-8",
        className,
      )}
    >
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Drive Mode</h2>
        <p className="text-muted-foreground">
          Tap and speak. Keep eyes forward.
        </p>
      </div>

      <Orb status={status} />

      {isProcessing && <Load message="Processing your request..." />}

      <VoiceBtn isRecording={isRecording} onToggle={onToggle} size="lg" />

      <div className="w-full max-w-md space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left">
        {transcript && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              You said
            </p>
            <p className="text-sm font-medium">{transcript}</p>
          </div>
        )}
        {reply && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Alfred
            </p>
            <p className="text-sm">{reply}</p>
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {!transcript && !reply && !error && (
          <p className="text-sm text-muted-foreground">
            Hold the button, speak a short command (&lt;10s), release to send.
          </p>
        )}
      </div>

      <button
        onClick={onComplete}
        className="rounded-lg border px-6 py-3 text-sm font-medium hover:bg-accent"
        aria-label="Exit drive mode"
      >
        Exit Drive Mode
      </button>
    </div>
  );
}
