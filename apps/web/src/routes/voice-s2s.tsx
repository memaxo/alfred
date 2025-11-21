import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { RouteError } from "@/components/route-error";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";

export const Route = createFileRoute("/voice-s2s")({
  component: VoiceS2SRouteView,
  errorComponent: RouteError,
});

export function VoiceS2SRouteView() {
  const {
    state,
    start,
    speechToSpeech,
    isRecording,
    isProcessing,
    lastResponse,
    error,
    clear,
  } = useVoiceSessionWeb();

  const [assistantText, setAssistantText] = useState("");

  const busyLabel = useMemo(() => {
    if (isProcessing) {
      return "Processing…";
    }
    if (isRecording) {
      return "Recording…";
    }
    return "Hold to talk";
  }, [isProcessing, isRecording]);

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      try {
        const result = await speechToSpeech();
        setAssistantText(result?.assistant?.text ?? "");
        toast.success("Response ready");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "voice_session_failed";
        toast.error(message);
      }
      return;
    }
    clear();
    setAssistantText("");
    try {
      await start();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "voice_session_failed";
      toast.error(message);
    }
  }, [clear, isRecording, speechToSpeech, start]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Voice (Speech to Speech)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Press the button, speak a short prompt, and Alfred will reply with
          synthesized speech via the unified voice pipeline.
        </p>
      </div>

      <button
        className="h-48 w-full rounded-3xl bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-60"
        disabled={isProcessing}
        onClick={handleToggle}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-lg font-semibold">{busyLabel}</span>
          <span className="text-sm text-blue-100">
            State: {state.capture.toUpperCase()}
          </span>
        </div>
      </button>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Transcript
        </h2>
        <p className="mt-2 text-base text-foreground min-h-[48px]">
          {state.transcript || "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Assistant Reply
        </h2>
        <p className="mt-2 text-base text-foreground min-h-[48px]">
          {assistantText || lastResponse?.assistant?.text || "Awaiting reply"}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
