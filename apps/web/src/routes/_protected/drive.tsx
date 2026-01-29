import type { UIMessage as AssistantUIMessage } from "@alfred/type/stream";

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AudioPlayer } from "@/components/audio";
import { DriveMode } from "@/components/drive-mode";
import { Mic } from "@/components/mic";
import { RouteError } from "@/components/route-error";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/drive")({
  component: DriveModeRoute,
  errorComponent: RouteError,
});

const SYSTEM_PROMPT =
  "You are Alfred, a driving copilot. Respond in under 20 words, prioritize safety, and confirm actions succinctly.";

function DriveModeRoute() {
  const navigate = Route.useNavigate();
  const [reply, setReply] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [micDeviceId, setMicDeviceId] = useState<string>("");
  const [micMuted, setMicMuted] = useState(false);

  const assistantGenerate = trpc.assistant.generate.useMutation();
  const voiceSynthesize = trpc.voice.ttsSynthesize.useMutation();

  const {
    isRecording,
    isProcessing,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useVoiceCapture({
    deviceId: micDeviceId || undefined,
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
        if (!audio?.audioBase64) {
          setAudioSrc(null);
          return;
        }
        setAudioSrc(`data:${audio.mimeType};base64,${audio.audioBase64}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "voice_pipeline_failed";
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
    if (micMuted) {
      toast.error("Microphone is muted");
      return;
    }
    if (isRecording) {
      stopRecording();
      return;
    }
    if (busy) {
      return;
    }
    setReply("");
    setAudioSrc(null);
    setErrorMessage(null);
    clearTranscript();
    startRecording().catch((error) => {
      const message =
        error instanceof Error ? error.message : "voice_capture_failed";
      setErrorMessage(message);
      toast.error(message);
    });
  }, [
    busy,
    clearTranscript,
    isRecording,
    micMuted,
    startRecording,
    stopRecording,
  ]);

  const handleExit = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-white/5 border-b p-3">
        <Mic
          className="w-64"
          muted={micMuted}
          onMutedChange={setMicMuted}
          onValueChange={setMicDeviceId}
          value={micDeviceId}
        />
        {audioSrc ? <AudioPlayer autoPlay={true} src={audioSrc} /> : null}
      </div>
      <div className="flex-1">
        <DriveMode
          error={errorMessage ?? error?.message ?? null}
          isProcessing={busy}
          isRecording={isRecording}
          onComplete={handleExit}
          onToggle={handleToggle}
          reply={reply}
          transcript={transcript}
        />
      </div>
    </div>
  );
}
