"use client";

/**
 * Voice Settings - Configuration panel for voice features
 */

import { Mic, Sliders, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceStore } from "@/store/voice";

type VoiceSettingsProps = {
  className?: string;
};

export function VoiceSettings({ className }: VoiceSettingsProps) {
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
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-void-surface p-4",
        className
      )}
    >
      <h3 className="mb-4 font-semibold">Voice Settings</h3>

      {/* Mode Selection */}
      <div className="mb-4">
        <label className="mb-2 block text-biolum-dim text-sm">Input Mode</label>
        <div className="flex gap-2">
          {(["push-to-talk", "voice-activity", "continuous"] as const).map(
            (m) => (
              <Button
                className={cn(mode === m && "bg-biolum/20")}
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
      </div>

      {/* VAD Sensitivity */}
      {mode === "voice-activity" && (
        <div className="mb-4">
          <label className="mb-2 block text-biolum-dim text-sm">
            VAD Sensitivity: {(vadSensitivity * 100).toFixed(0)}%
          </label>
          <input
            className="w-full"
            max="1"
            min="0"
            onChange={(e) =>
              setVadSensitivity(Number.parseFloat(e.target.value))
            }
            step="0.1"
            type="range"
            value={vadSensitivity}
          />
        </div>
      )}

      {/* Input Device */}
      <div className="mb-4">
        <label className="mb-2 flex items-center gap-2 text-biolum-dim text-sm">
          <Mic className="h-4 w-4" />
          Input Device
        </label>
        <select
          className="w-full rounded-lg border border-white/10 bg-void p-2 text-sm"
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
      </div>

      {/* Output Device */}
      <div className="mb-4">
        <label className="mb-2 flex items-center gap-2 text-biolum-dim text-sm">
          <Volume2 className="h-4 w-4" />
          Output Device
        </label>
        <select
          className="w-full rounded-lg border border-white/10 bg-void p-2 text-sm"
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
      </div>

      {/* TTS Voice */}
      <div className="mb-4">
        <label className="mb-2 flex items-center gap-2 text-biolum-dim text-sm">
          <Sliders className="h-4 w-4" />
          TTS Voice
        </label>
        <div className="flex flex-wrap gap-2">
          {ttsVoices.map((voice) => (
            <Button
              className={cn(ttsVoice === voice && "bg-biolum/20")}
              key={voice}
              onClick={() => setTtsVoice(voice)}
              size="sm"
              variant="outline"
            >
              {voice}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
