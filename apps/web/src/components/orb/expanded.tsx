/**
 * Expanded Orb - Full-screen voice overlay
 */

import { Mic, MicOff, Settings, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrbStore } from "@/store/orb";
import { useVoiceStore } from "@/store/voice";

import { OrbCore } from "./core";
import { Waveform } from "./waveform";

export function ExpandedOrb() {
  const dock = useOrbStore((s) => s.dock);
  const state = useOrbStore((s) => s.state);
  const setListening = useOrbStore((s) => s.setListening);
  const setIdle = useOrbStore((s) => s.setIdle);

  const isListening = useVoiceStore((s) => s.isListening);
  const transcript = useVoiceStore((s) => s.transcript);
  const interimTranscript = useVoiceStore((s) => s.interimTranscript);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const currentUtterance = useVoiceStore((s) => s.currentUtterance);
  const startListening = useVoiceStore((s) => s.startListening);
  const stopListening = useVoiceStore((s) => s.stopListening);

  const handleToggleListen = () => {
    if (isListening) {
      stopListening();
      setIdle();
    } else {
      startListening();
      setListening();
    }
  };

  const handleClose = () => {
    stopListening();
    setIdle();
    dock();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-void/95 backdrop-blur-lg">
      {/* Close button */}
      <Button
        className="absolute top-4 right-4"
        onClick={handleClose}
        size="icon"
        variant="ghost"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Orb */}
      <div className="relative mb-8">
        <OrbCore size="lg" />
      </div>

      {/* State label */}
      <div className="mb-8 text-center">
        <h2 className="font-semibold text-2xl capitalize">
          {state === "idle" ? "Ready" : `${state}...`}
        </h2>
        <p className="mt-1 text-biolum-dim text-sm">
          {state === "idle" && "Click the microphone to start"}
          {state === "listening" && "Listening to you..."}
          {state === "thinking" && "Processing your request..."}
          {state === "talking" && "Speaking..."}
          {state === "active" && "Multiple agents working..."}
        </p>
      </div>

      {/* Transcript */}
      <div className="mb-8 w-full max-w-2xl px-8">
        {(transcript || interimTranscript) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-lg">
              {transcript}
              {interimTranscript && (
                <span className="text-biolum-dim">{interimTranscript}</span>
              )}
            </p>
          </div>
        )}

        {isSpeaking && currentUtterance && (
          <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-green-400 text-xs">
              <Volume2 className="h-3 w-3" />
              <span>ALFRED</span>
            </div>
            <p className="text-lg">{currentUtterance}</p>
          </div>
        )}
      </div>

      {/* Waveform */}
      <Waveform className="mb-8 h-16 w-full max-w-2xl" />

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          className={cn(
            "h-16 w-16 rounded-full",
            isListening
              ? "bg-red-500 hover:bg-red-600"
              : "bg-biolum hover:bg-biolum/90"
          )}
          onClick={handleToggleListen}
          size="icon"
        >
          {isListening ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        <Button
          className="h-12 w-12 rounded-full"
          size="icon"
          variant="outline"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
