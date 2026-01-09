import { CheckCircle, Mic, MicOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { useAudioDevices } from "@/components/ui/mic-selector";
import { cn } from "@/lib/utils";
import { useVoiceStore, type VoiceMode } from "@/store/voice";

export type VoiceStepProps = {
  onComplete?: () => void;
};

const voiceModes: { value: VoiceMode; label: string; description: string }[] = [
  {
    value: "push-to-talk",
    label: "Push to Talk",
    description: "Hold a key to speak",
  },
  {
    value: "voice-activity",
    label: "Voice Activity",
    description: "Auto-detect when you speak",
  },
  {
    value: "continuous",
    label: "Continuous",
    description: "Always listening",
  },
];

export function VoiceStep({ onComplete }: VoiceStepProps) {
  const { devices, loading, hasPermission, loadDevices } = useAudioDevices();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const { mode, setMode, setInputDevice, vadSensitivity, setVadSensitivity } =
    useVoiceStore();

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]?.deviceId || "");
    }
  }, [devices, selectedDevice]);

  const handleRequestPermission = useCallback(async () => {
    await loadDevices();
    setPermissionGranted(true);
  }, [loadDevices]);

  const handleDeviceSelect = useCallback(
    (deviceId: string) => {
      setSelectedDevice(deviceId);
      const device = devices.find((d) => d.deviceId === deviceId);
      if (device) {
        setInputDevice({
          deviceId: device.deviceId,
          label: device.label,
          kind: "audioinput",
        });
      }
    },
    [devices, setInputDevice]
  );

  const handleTestMic = useCallback(() => {
    setIsTesting(!isTesting);
  }, [isTesting]);

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-2xl text-biolum tracking-tighter">
          Set Up Voice
        </h2>
        <p className="text-biolum-dim">
          Configure your microphone for voice commands. This step is optional.
        </p>
      </div>

      {hasPermission || permissionGranted ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
            <h3 className="mb-4 font-medium text-biolum tracking-tight">
              Select Microphone
            </h3>
            {loading ? (
              <p className="text-biolum-dim text-sm">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p className="text-biolum-dim text-sm">No microphones found</p>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <button
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                      selectedDevice === device.deviceId
                        ? "border-biolum/50 bg-biolum/10"
                        : "border-white/10 hover:border-white/20"
                    )}
                    key={device.deviceId}
                    onClick={() => handleDeviceSelect(device.deviceId)}
                    type="button"
                  >
                    <span className="text-biolum text-sm">{device.label}</span>
                    {selectedDevice === device.deviceId && (
                      <CheckCircle className="h-4 w-4 text-biolum" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedDevice && (
              <div className="mt-4 flex items-center gap-3">
                <Button
                  className="rounded-full"
                  onClick={handleTestMic}
                  size="sm"
                  variant="outline"
                >
                  {isTesting ? (
                    <>
                      <MicOff className="mr-2 h-4 w-4" />
                      Stop Test
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Test Mic
                    </>
                  )}
                </Button>
                <div className="flex-1 overflow-hidden rounded-xl bg-void-surface/60 p-2">
                  <LiveWaveform
                    active={isTesting}
                    barGap={2}
                    barWidth={4}
                    deviceId={selectedDevice}
                    height={24}
                    mode="static"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
            <h3 className="mb-4 font-medium text-biolum tracking-tight">
              Voice Mode
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {voiceModes.map((vm) => (
                <button
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    mode === vm.value
                      ? "border-biolum/50 bg-biolum/10"
                      : "border-white/10 hover:border-white/20"
                  )}
                  key={vm.value}
                  onClick={() => setMode(vm.value)}
                  type="button"
                >
                  <span className="block font-medium text-biolum text-sm">
                    {vm.label}
                  </span>
                  <span className="text-biolum-dim text-xs">
                    {vm.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {mode === "voice-activity" && (
            <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
              <h3 className="mb-4 font-medium text-biolum tracking-tight">
                VAD Sensitivity
              </h3>
              <input
                className="w-full"
                max={1}
                min={0}
                onChange={(e) =>
                  setVadSensitivity(Number.parseFloat(e.target.value))
                }
                step={0.1}
                type="range"
                value={vadSensitivity}
              />
              <div className="mt-2 flex justify-between text-biolum-dim text-xs">
                <span>Less Sensitive</span>
                <span>More Sensitive</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-8 text-center backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-4">
              <Mic className="h-8 w-8 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="mb-2 font-medium text-biolum tracking-tight">
            Microphone Access Required
          </h3>
          <p className="mb-6 text-biolum-dim text-sm">
            ALFRED needs access to your microphone for voice commands.
          </p>
          <Button className="rounded-full" onClick={handleRequestPermission}>
            <Mic className="mr-2 h-4 w-4" />
            Enable Microphone
          </Button>
        </div>
      )}

      {onComplete && (
        <div className="flex justify-center pt-4">
          <Button
            className="text-biolum-dim hover:text-biolum"
            onClick={onComplete}
            variant="ghost"
          >
            Skip voice setup
          </Button>
        </div>
      )}
    </div>
  );
}
