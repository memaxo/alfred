import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScrambleText } from "@/components/scramble-text";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";
import { MindscapeEngine } from "@/lib/mindscape/engine";
import { trpc } from "@/utils/trpc";
import { fetchInitialMindscape } from "./index.server";

export const Route = createFileRoute("/")({
  component: Mindscape,
  loader: () => fetchInitialMindscape(),
});

function Mindscape() {
  const { ascii } = Route.useLoaderData();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MindscapeEngine | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const voiceSession = useVoiceSessionWeb(trpc);

  // Sync Agent State with Engine
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    if (voiceSession.state.isSpeaking) {
      engineRef.current.setAgentState("speaking");
    } else if (voiceSession.state.isProcessing) {
      engineRef.current.setAgentState("processing");
    } else if (voiceSession.state.isRecording) {
      engineRef.current.setAgentState("listening");
    } else {
      engineRef.current.setAgentState("idle");
    }
  }, [voiceSession.state]);

  const handleEnter = () => {
    engineRef.current?.triggerWarp();
    setTimeout(() => {
      navigate({ to: "/mindscape" });
    }, 800);
  };

  const toggleAudio = async () => {
    if (!engineRef.current) {
      return;
    }

    if (!audioEnabled) {
      await engineRef.current.enableAudio();
      setAudioEnabled(true);
    }
  };

  const toggleVoiceSession = async () => {
    if (
      voiceSession.state.isRecording ||
      voiceSession.state.isProcessing ||
      voiceSession.state.isSpeaking
    ) {
      voiceSession.clear();
    } else {
      await toggleAudio(); // Ensure mic is active for visualization too
      await voiceSession.start();
    }
  };

  // Push-to-Talk
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (
        e.code === "Space" &&
        !e.repeat &&
        !voiceSession.state.isRecording &&
        !voiceSession.state.isProcessing &&
        !voiceSession.state.isSpeaking
      ) {
        e.preventDefault();
        await toggleAudio(); // Ensure context is active
        await voiceSession.start();
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space" && voiceSession.state.isRecording) {
        e.preventDefault();
        await voiceSession.stopAndTranscribe();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    voiceSession.state,
    toggleAudio,
    voiceSession.start,
    voiceSession.stopAndTranscribe,
  ]); // Re-bind when state changes

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    // Initialize the engine - Takes over the DOM
    engineRef.current = new MindscapeEngine(canvasRef.current);

    // Trigger fade in after a brief moment to allow engine to render first frame
    const timer = setTimeout(() => setIsLoaded(true), 100);

    return () => {
      engineRef.current?.destroy();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative h-screen w-full cursor-none overflow-hidden bg-[oklch(0.05_0_0)]">
      {/* The Canvas Overlay (WebGPU) */}
      <canvas
        className={`absolute inset-0 z-10 h-full w-full transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        ref={canvasRef}
      />

      {/* The SSR Static Layer (Immediate Visual) */}
      <pre
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex h-full w-full select-none items-center justify-center overflow-hidden whitespace-pre font-mono text-[oklch(0.14_0_0)] text-xs leading-none"
      >
        {ascii}
      </pre>

      {/* UI Overlay */}
      <div className="-translate-x-1/2 -translate-y-1/2 pointer-events-auto absolute top-1/2 left-1/2 z-20 cursor-auto text-center mix-blend-screen">
        <h1 className="mb-8 bg-gradient-to-b from-[oklch(0.99_0_0)] to-[oklch(0.70_0_0)] bg-clip-text font-bold font-sans text-6xl text-transparent tracking-[-0.04em]">
          ALFRED
        </h1>

        <div className="flex flex-col items-center gap-6">
          <button
            className="rounded-full border border-[oklch(0.40_0_0)] px-6 py-2 text-[oklch(0.99_0_0)] tracking-tight transition-all duration-300 hover:bg-[oklch(0.99_0_0)] hover:text-[oklch(0.05_0_0)]"
            onClick={handleEnter}
          >
            ENTER MINDSCAPE
          </button>

          <div className="flex gap-4">
            <button
              className={`flex items-center gap-2 text-sm ${audioEnabled ? "text-[oklch(0.99_0_0)]" : "text-[oklch(0.40_0_0)]"} transition-colors hover:text-[oklch(0.99_0_0)]`}
              onClick={toggleAudio}
              title="Enable Audio Reactivity"
            >
              {audioEnabled ? (
                <Activity className="h-4 w-4" />
              ) : (
                <Activity className="h-4 w-4 opacity-50" />
              )}
            </button>

            <button
              className={`flex items-center gap-2 text-sm ${voiceSession.state.isRecording ? "animate-pulse text-red-500" : voiceSession.state.isProcessing ? "text-blue-400" : "text-[oklch(0.40_0_0)]"} transition-colors hover:text-[oklch(0.99_0_0)]`}
              onClick={toggleVoiceSession}
              title="Talk to Alfred"
            >
              {voiceSession.state.isSpeaking ? (
                <Volume2 className="h-4 w-4" />
              ) : voiceSession.state.isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Minimal Transcript Display */}
          {(voiceSession.state.transcript ||
            voiceSession.lastResponse?.assistant.text) && (
            <div className="mt-4 max-w-md rounded-2xl border border-[oklch(0.20_0_0)] bg-[oklch(0.05_0_0)]/80 p-4 text-left font-mono backdrop-blur-md">
              {voiceSession.state.transcript && (
                <p className="mb-2 text-[oklch(0.70_0_0)] text-sm">
                  {"> "} <ScrambleText text={voiceSession.state.transcript} />
                </p>
              )}
              {voiceSession.lastResponse && (
                <p className="text-[oklch(0.99_0_0)] text-sm">
                  <ScrambleText
                    text={voiceSession.lastResponse.assistant.text}
                  />
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
