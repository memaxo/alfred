/**
 * Voice Settings Section
 *
 * Configuration panel for voice features.
 * Migrated from components/orb/voice-settings.tsx
 */

import { Mic, Sliders, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceStore } from "@/store/voice";

export function VoiceSection() {
  const mode = useVoiceStore((s) => s.mode);
  const setMode = useVoiceStore((s) => s.setMode);
  const vadSensitivity = useVoiceStore((s) => s.vadSensitivity);
  const setVadSensitivity = useVoiceStore((s) => s.setVadSensitivity);
  const inputDevice = useVoiceStore((s) => s.inputDevice);
  const outputDevice = useVoiceStore((s) => s.outputDevice);
  const availableInputDevices = useVoiceStore((s) => s.availableInputDevices);
  const availableOutputDevices = useVoiceStore((s) => s.availableOutputDevices);
  const setInputDevice = useVoiceStore((s) => s.setInputDevice);
  const setOutputDevice = useVoiceStore((s) => s.setOutputDevice);
  const ttsVoice = useVoiceStore((s) => s.ttsVoice);
  const setTtsVoice = useVoiceStore((s) => s.setTtsVoice);

  const ttsVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-lg">Voice & Speech</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Configure speech-to-text, text-to-speech, input mode, and device
          selection.
        </p>
      </div>

      {/* Mode Selection */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="block font-medium text-sm">Input Mode</label>
        <div className="flex gap-2">
          {(["push-to-talk", "voice-activity", "continuous"] as const).map(
            (m) => (
              <Button
                className={cn(mode === m && "bg-biolum/20 text-biolum")}
                key={m}
                onClick={() => setMode(m)}
                size="sm"
                variant="outline"
              >
                {m.replace("-", " ")}
              </Button>
            )
          )}
        </div>
        <p className="text-biolum-dim text-xs">
          {mode === "push-to-talk"
            ? "Hold space bar to record"
            : mode === "voice-activity"
              ? "Automatically detect when you start speaking"
              : "Always listening for voice input"}
        </p>
      </section>

      {/* VAD Sensitivity */}
      {mode === "voice-activity" && (
        <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="block font-medium text-sm">
            VAD Sensitivity: {(vadSensitivity * 100).toFixed(0)}%
          </label>
          <input
            className="w-full accent-biolum"
            max="1"
            min="0"
            onChange={(e) =>
              setVadSensitivity(Number.parseFloat(e.target.value))
            }
            step="0.1"
            type="range"
            value={vadSensitivity}
          />
          <p className="text-biolum-dim text-xs">
            Lower sensitivity requires louder speech to activate
          </p>
        </section>
      )}

      {/* Input Device */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-2 font-medium text-sm">
          <Mic className="h-4 w-4" />
          Input Device
        </label>
        <select
          className="w-full rounded-lg border border-white/10 bg-void p-2 text-sm focus:border-biolum focus:outline-none focus:ring-2 focus:ring-biolum/50"
          onChange={(e) => {
            const device = availableInputDevices.find(
              (d) => d.deviceId === e.target.value
            );
            if (device) {
              setInputDevice(device);
            }
          }}
          value={inputDevice?.deviceId ?? ""}
        >
          <option value="">Default</option>
          {availableInputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </section>

      {/* Output Device */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-2 font-medium text-sm">
          <Volume2 className="h-4 w-4" />
          Output Device
        </label>
        <select
          className="w-full rounded-lg border border-white/10 bg-void p-2 text-sm focus:border-biolum focus:outline-none focus:ring-2 focus:ring-biolum/50"
          onChange={(e) => {
            const device = availableOutputDevices.find(
              (d) => d.deviceId === e.target.value
            );
            if (device) {
              setOutputDevice(device);
            }
          }}
          value={outputDevice?.deviceId ?? ""}
        >
          <option value="">Default</option>
          {availableOutputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </section>

      {/* TTS Voice */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-2 font-medium text-sm">
          <Sliders className="h-4 w-4" />
          TTS Voice
        </label>
        <div className="flex flex-wrap gap-2">
          {ttsVoices.map((voice) => (
            <Button
              className={cn(ttsVoice === voice && "bg-biolum/20 text-biolum")}
              key={voice}
              onClick={() => setTtsVoice(voice)}
              size="sm"
              variant="outline"
            >
              {voice}
            </Button>
          ))}
        </div>
        <p className="text-biolum-dim text-xs">
          Select the voice personality for text-to-speech
        </p>
      </section>
    </div>
  );
}
