import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RouteError } from "@/components/route-error";
import { Input } from "@/components/text";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { ConversationBar } from "@/components/ui/conversation-bar";
import { Matrix } from "@/components/ui/matrix";
import { Message, MessageContent } from "@/components/ui/message";
import { Viz } from "@/components/viz";
import { Voice } from "@/components/voice";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/voice-s2s")({
  component: VoiceS2SRouteView,
  errorComponent: RouteError,
});

function VoiceS2SRouteView() {
  const {
    state,
    session,
    start,
    speechToSpeech,
    isRecording,
    isProcessing,
    lastResponse,
    error,
    clear,
    stream,
  } = useVoiceSessionWeb();

  const [assistantText, setAssistantText] = useState("");
  const [agentId, setAgentId] = useState("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [frequencyData, setFrequencyData] = useState<number[]>(
    new Array(20).fill(0)
  );

  const voicesQuery = trpc.voice.listVoices.useQuery();
  const voices = voicesQuery.data ?? [];

  useEffect(() => {
    if (!stream.analyser) {
      return;
    }

    const analyser = stream.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const update = () => {
      analyser.getByteFrequencyData(dataArray);

      // Downsample for visualization (e.g. 20 bars)
      const barCount = 20;
      const step = Math.floor(bufferLength / barCount);
      const bars: number[] = [];

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j] ?? 0;
        }
        // Normalize 0-1
        bars.push(sum / step / 255);
      }

      setFrequencyData(bars);
      animationId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animationId);
  }, [stream.analyser]);

  const busyLabel = useMemo(() => {
    if (isProcessing) {
      return "Processing…";
    }
    if (isRecording) {
      return "Recording…";
    }
    return "Hold to talk";
  }, [isProcessing, isRecording]);

  const streamingDisabled =
    !stream.supported ||
    stream.status === "processing" ||
    stream.status === "playing" ||
    stream.status === "connecting";
  const streamingButtonLabel = stream.isActive
    ? "Stop streaming"
    : stream.status === "processing"
      ? "Finishing…"
      : "Start streaming";
  const vadPercent =
    typeof stream.vadConfidence === "number"
      ? Math.min(1, Math.max(0, stream.vadConfidence)) * 100
      : 0;
  const handsFreeStatus = stream.isActive
    ? "Live"
    : stream.status === "playing"
      ? "Speaking"
      : stream.status === "processing"
        ? "Processing"
        : "Standby";
  const handsFreeHelper = stream.autoStopReason
    ? `Auto-stop: ${stream.autoStopReason}`
    : stream.status === "recording"
      ? "Listening (auto-stop armed)"
      : "Press start to go hands-free.";

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      try {
        const result = (await speechToSpeech()) as
          | { assistant?: { text?: string } }
          | undefined;
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

  const handleStreamToggle = useCallback(async () => {
    if (!stream.supported) {
      toast.error("Streaming prototype unavailable");
      return;
    }
    try {
      if (stream.isActive || stream.status === "recording") {
        await stream.stop();
        toast.success("Streaming stopped");
      } else {
        await stream.start();
        toast.success("Streaming started");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "voice_stream_failed";
      toast.error(message);
    }
  }, [stream]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        return;
      }
      if (
        e.code === "Space" &&
        !isRecording &&
        !isProcessing &&
        !stream.isActive &&
        !e.target?.hasOwnProperty("value")
      ) {
        e.preventDefault();
        handleToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isRecording) {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleToggle, isRecording, isProcessing, stream.isActive]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">
          Voice (Speech to Speech)
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
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
          <span className="font-semibold text-lg">{busyLabel}</span>
          <span className="text-blue-100 text-sm">
            State: {state.capture.toUpperCase()}
          </span>
        </div>
      </button>

      {stream.supported ? (
        <button
          className="h-32 w-full rounded-3xl bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:opacity-60"
          disabled={streamingDisabled}
          onClick={handleStreamToggle}
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="font-semibold text-lg">
              {streamingButtonLabel} (Streaming Prototype)
            </span>
            <span className="text-emerald-100 text-sm">
              Status: {stream.status.toUpperCase()}
            </span>
            <span className="text-emerald-200 text-xs uppercase tracking-wide">
              Hands-free {stream.isActive ? "Live" : "Ready"}
            </span>
            {stream.vadConfidence !== null ? (
              <span className="text-emerald-100 text-xs">
                VAD confidence: {(stream.vadConfidence ?? 0).toFixed(2)}
              </span>
            ) : null}
          </div>
        </button>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm">
          Transcript
        </h2>
        <p className="mt-2 min-h-[48px] text-base text-foreground">
          {state.transcript || "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm">
          Voice (TTS)
        </h2>
        <p className="mt-2 text-muted-foreground text-xs">
          Select a synthesis voice (local provider).
        </p>
        {voices.length > 0 ? (
          <div className="mt-3">
            <Voice
              onSelect={setVoiceId}
              selected={voiceId || voices[0]?.id || ""}
              voices={voices}
            />
          </div>
        ) : (
          <p className="mt-3 text-biolum-dim text-sm">No voices available.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm">
          Assistant Reply
        </h2>
        <p className="mt-2 min-h-[48px] text-base text-foreground">
          {assistantText || lastResponse?.assistant?.text || "Awaiting reply"}
        </p>
      </div>

      {stream.supported ? (
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center justify-between font-medium text-foreground text-sm">
              <span>Hands-free status</span>
              <span
                className={
                  stream.isActive ? "text-emerald-500" : "text-muted-foreground"
                }
              >
                {handsFreeStatus}
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-border/50">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${vadPercent}%` }}
              />
            </div>
            {stream.isActive && stream.analyser && (
              <div className="mt-4 flex justify-center">
                <Viz
                  className="h-16 gap-1 text-emerald-500"
                  data={frequencyData}
                />
              </div>
            )}
            {stream.isActive && stream.analyser && (
              <div className="mt-4 flex justify-center">
                <Matrix
                  ariaLabel="voice levels matrix"
                  className="text-emerald-500"
                  cols={20}
                  gap={2}
                  levels={frequencyData}
                  mode="vu"
                  rows={8}
                  size={6}
                />
              </div>
            )}
            <p className="mt-2 text-muted-foreground text-xs">
              {handsFreeHelper}
            </p>
          </div>
          <div>
            <h2 className="font-medium text-muted-foreground text-sm">
              Streaming Transcript
            </h2>
            <p className="mt-2 min-h-[48px] text-base text-foreground">
              {stream.transcript || "—"}
            </p>
          </div>
          <div>
            <h2 className="font-medium text-muted-foreground text-sm">
              Streaming Reply
            </h2>
            <p className="mt-2 min-h-[48px] text-base text-foreground">
              {stream.assistantText || "Awaiting reply"}
            </p>
          </div>
          <div className="text-muted-foreground text-sm">
            <span>Status: {stream.status}</span>
            {stream.autoStopReason ? (
              <span className="ml-3">Auto-stop: {stream.autoStopReason}</span>
            ) : null}
          </div>
          {stream.error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {stream.error}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm">
          Conversation (UI primitives)
        </h2>
        <div className="mt-3 h-64 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
          <Conversation>
            <ConversationContent>
              {state.transcript || assistantText || lastResponse ? (
                <>
                  {state.transcript ? (
                    <Message from="user">
                      <MessageContent>{state.transcript}</MessageContent>
                    </Message>
                  ) : null}
                  {assistantText || lastResponse?.assistant?.text ? (
                    <Message from="assistant">
                      <MessageContent>
                        {assistantText || lastResponse?.assistant?.text}
                      </MessageContent>
                    </Message>
                  ) : null}
                </>
              ) : (
                <ConversationEmptyState
                  description="Speak or stream to populate the conversation."
                  title="No voice messages yet"
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm">
          ElevenLabs Agent Conversation Bar
        </h2>
        <p className="mt-2 text-muted-foreground text-xs">
          Optional: enter an ElevenLabs agent ID to enable the conversation bar.
        </p>
        <div className="mt-3 space-y-3">
          <Input
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Agent ID (optional)"
            value={agentId}
          />
          {agentId.trim().length > 0 ? (
            <ConversationBar agentId={agentId.trim()} />
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-muted-foreground text-sm">
        <p className="font-medium text-foreground">Session</p>
        <p className="mt-1 text-base text-foreground">
          {stream.sessionId
            ? `Streaming ID: ${stream.sessionId}`
            : session
              ? `Session ID: ${session.id}`
              : "Session pending"}
        </p>
        {session ? (
          <p className="mt-1">
            Surface: {session.surface} · Updated{" "}
            {new Date(session.updatedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
