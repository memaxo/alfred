import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ScrambleText } from "@/components/scramble-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";

export const Route = createFileRoute("/_protected/experimental/tune")({
  component: VoiceTuner,
});

function VoiceTuner() {
  const [vadThreshold, setVadThreshold] = useState(0.5);
  const [maxUtteranceMs, setMaxUtteranceMs] = useState(20_000);
  const [_silenceTimeoutMs, _setSilenceTimeoutMs] = useState(1000); // Client-side? No, this should drive autoStop

  // Note: In current implementation, maxUtteranceMs is total length, not silence.
  // The server uses VAD logic internally.
  // But our hook sends vadThreshold to server.

  const voiceSession = useVoiceSessionWeb();
  const isRecording = voiceSession.stream.isActive;

  const toggleSession = async () => {
    if (isRecording) {
      await voiceSession.stream.stop();
    } else {
      await voiceSession.stream.start({
        vadThreshold,
        maxUtteranceMs,
      });
    }
  };

  return (
    <div className="min-h-screen bg-void p-8 text-biolum">
      <h1 className="mb-8 font-bold text-3xl">Voice VAD Tuner</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <h2 className="mb-4 font-semibold text-xl">Controls</h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>VAD Threshold</Label>
                <span className="font-mono text-sm">
                  {vadThreshold.toFixed(2)}
                </span>
              </div>
              <Slider
                disabled={isRecording}
                max={1}
                min={0}
                onValueChange={([v]) => setVadThreshold(v ?? 0.5)}
                step={0.05}
                value={[vadThreshold]}
              />
              <p className="text-biolum-dim text-xs">
                Higher = Less sensitive (needs louder speech).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Max Utterance (ms)</Label>
                <span className="font-mono text-sm">{maxUtteranceMs}ms</span>
              </div>
              <Slider
                disabled={isRecording}
                max={60_000}
                min={1000}
                onValueChange={([v]) => setMaxUtteranceMs(v ?? 20_000)}
                step={1000}
                value={[maxUtteranceMs]}
              />
            </div>

            <Button
              className={`w-full rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-biolum text-void hover:bg-biolum/90"}`}
              onClick={toggleSession}
            >
              {isRecording ? "Stop Session" : "Start Tuning Session"}
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
          <h2 className="mb-4 font-semibold text-xl">Feedback</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-void/50 p-4">
              <span>Status</span>
              <span
                className={`font-mono uppercase ${
                  voiceSession.stream.status === "recording"
                    ? "animate-pulse text-red-400"
                    : voiceSession.stream.status === "processing"
                      ? "text-blue-400"
                      : "text-biolum-dim"
                }`}
              >
                {voiceSession.stream.status}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-void/50 p-4">
              <span>VAD Confidence</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-void-surface">
                  <div
                    className="h-full bg-biolum transition-all duration-100"
                    style={{
                      width: `${(voiceSession.stream.vadConfidence ?? 0) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-sm">
                  {(voiceSession.stream.vadConfidence ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-white/5 bg-void/50 p-4">
              <span className="text-biolum-dim text-sm">Transcript</span>
              <div className="min-h-[3rem] font-mono text-sm">
                {voiceSession.stream.transcript || (
                  <span className="text-biolum-faint italic">
                    Waiting for speech...
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-white/5 bg-void/50 p-4">
              <span className="text-biolum-dim text-sm">Response</span>
              <div className="min-h-[3rem] font-mono text-biolum text-sm">
                {voiceSession.stream.assistantText ? (
                  <ScrambleText text={voiceSession.stream.assistantText} />
                ) : (
                  <span className="text-biolum-faint italic">...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
