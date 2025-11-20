import type { AssistantUIMessage } from "@alfred/agent";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DriveMode } from "@/components/drive-mode";
import { RouteError } from "@/components/route-error";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/drive")({
  component: DriveModeRoute,
  errorComponent: RouteError,
});

const SYSTEM_PROMPT =
  "You are Alfred, a driving copilot. Respond in under 20 words, prioritize safety, and confirm actions succinctly.";

function DriveModeRoute() {
  const navigate = Route.useNavigate();
  const [reply, setReply] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const assistantGenerate = trpc.assistant.generate.useMutation();
  const voiceSynthesize = trpc.voice.ttsSynthesize.useMutation();

  const {
    isRecording,
    isProcessing,
    transcript,
    error,
    startRecording,
    stopRecording,
    playAudio,
    clearTranscript,
  } = useVoiceCapture({
    onTranscript: async (text) => {
      setErrorMessage(null);
      try {
        const messages: AssistantUIMessage[] = [
          {
            id: "system-1",
            role: "system",
            parts: [{ type: "text", text: SYSTEM_PROMPT }],
          },
          {
            id: `user-${Date.now()}`,
            role: "user",
            parts: [{ type: "text", text }],
          },
        ];
        const response = await assistantGenerate.mutateAsync({ messages });
        const assistantReply = response?.text?.trim();
        if (!assistantReply) {
          throw new Error("assistant_reply_empty");
        }
        setReply(assistantReply);
        const audio = await voiceSynthesize.mutateAsync({
          text: assistantReply,
          voice: "alloy",
          format: "mp3",
        });
        if (audio?.audioBase64) {
          playAudio(audio.audioBase64, audio.mimeType);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "voice_pipeline_failed";
        setErrorMessage(message);
        toast.error(message);
      }
    },
    onError: (err) => {
      const message = err.message || "voice_capture_failed";
      setErrorMessage(message);
      toast.error(message);
    },
  });

  const busy = useMemo(
    () =>
      isProcessing || assistantGenerate.isPending || voiceSynthesize.isPending,
    [assistantGenerate.isPending, isProcessing, voiceSynthesize.isPending]
  );

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (busy) {
      return;
    }
    setReply("");
    setErrorMessage(null);
    clearTranscript();
    startRecording().catch((err) => {
      const message =
        err instanceof Error ? err.message : "voice_capture_failed";
      setErrorMessage(message);
      toast.error(message);
    });
  }, [
    busy,
    clearTranscript,
    isRecording,
    setReply,
    setErrorMessage,
    startRecording,
    stopRecording,
  ]);

  const handleExit = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <DriveMode
      error={errorMessage ?? error?.message ?? null}
      isProcessing={busy}
      isRecording={isRecording}
      onComplete={handleExit}
      onToggle={handleToggle}
      reply={reply}
      transcript={transcript}
    />
  );
}
