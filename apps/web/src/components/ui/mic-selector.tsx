import { Check, ChevronsUpDown, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { cn } from "@/lib/utils";

export type AudioDevice = {
  deviceId: string;
  label: string;
  groupId: string;
};

export type MicSelectorProps = {
  value?: string;
  onValueChange?: (deviceId: string) => void;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function MicSelector({
  value,
  onValueChange,
  muted,
  onMutedChange,
  disabled,
  className,
}: MicSelectorProps) {
  const { devices, loading, error, hasPermission, loadDevices } =
    useAudioDevices();
  const [selectedDevice, setSelectedDevice] = useState<string>(value || "");
  const [internalMuted, setInternalMuted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Use controlled muted if provided, otherwise use internal state
  const isMuted = muted !== undefined ? muted : internalMuted;

  // Update internal state when controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedDevice(value);
    }
  }, [value]);

  // Select first device by default
  const defaultDeviceId = devices[0]?.deviceId || "";
  useEffect(() => {
    if (!selectedDevice && defaultDeviceId) {
      const newDevice = defaultDeviceId;
      setSelectedDevice(newDevice);
      onValueChange?.(newDevice);
    }
  }, [defaultDeviceId, selectedDevice, onValueChange]);

  const currentDevice = devices.find((d) => d.deviceId === selectedDevice) ||
    devices[0] || {
      label: loading ? "Loading..." : "No microphone",
      deviceId: "",
    };

  const handleDeviceSelect = (deviceId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    setSelectedDevice(deviceId);
    onValueChange?.(deviceId);
  };

  const handleDropdownOpenChange = async (open: boolean) => {
    setIsDropdownOpen(open);
    if (open && !hasPermission && !loading) {
      await loadDevices();
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    if (muted === undefined) {
      setInternalMuted(newMuted);
    }
    onMutedChange?.(newMuted);
  };

  const isPreviewActive = isDropdownOpen && !isMuted;

  return (
    <DropdownMenu onOpenChange={handleDropdownOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "flex w-48 cursor-pointer items-center gap-1.5 hover:bg-accent",
            className
          )}
          disabled={loading || disabled}
          size="sm"
          variant="ghost"
        >
          {isMuted ? (
            <MicOff className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Mic className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-left">
            {currentDevice.label}
          </span>
          <ChevronsUpDown className="h-3 w-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-72" side="top">
        {loading ? (
          <DropdownMenuItem disabled>Loading devices...</DropdownMenuItem>
        ) : error ? (
          <DropdownMenuItem disabled>Error: {error}</DropdownMenuItem>
        ) : (
          devices.map((device) => (
            <DropdownMenuItem
              className="flex items-center justify-between"
              key={device.deviceId}
              onClick={(e) => handleDeviceSelect(device.deviceId, e)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{device.label}</span>
              {selectedDevice === device.deviceId && (
                <Check className="h-4 w-4 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))
        )}
        {devices.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 p-2">
              <Button
                className="h-8 gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  toggleMute();
                }}
                size="sm"
                variant="ghost"
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span className="text-sm">{isMuted ? "Unmute" : "Mute"}</span>
              </Button>
              <div className="ml-auto w-16 overflow-hidden rounded-md bg-accent p-1.5">
                <LiveWaveform
                  active={isPreviewActive}
                  barGap={1}
                  barWidth={3}
                  deviceId={selectedDevice || defaultDeviceId}
                  height={15}
                  mode="static"
                />
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const loadDevicesWithoutPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      setError("media_devices_unavailable");
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const deviceList = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => {
          let cleanLabel =
            device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
          cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, "").trim();

          return {
            deviceId: device.deviceId,
            label: cleanLabel,
            groupId: device.groupId,
          };
        });

      setDevices(audioInputs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get audio devices"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDevicesWithPermission = useCallback(async () => {
    if (loading) {
      return;
    }

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) {
      setDevices([]);
      setError("media_devices_unavailable");
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tempStream = await mediaDevices.getUserMedia({
        audio: true,
      });
      tempStream.getTracks().forEach((track) => track.stop());

      const deviceList = await mediaDevices.enumerateDevices();

      const audioInputs = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => {
          let cleanLabel =
            device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
          cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, "").trim();

          return {
            deviceId: device.deviceId,
            label: cleanLabel,
            groupId: device.groupId,
          };
        });

      setDevices(audioInputs);
      setHasPermission(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get audio devices"
      );
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    loadDevicesWithoutPermission();
  }, [loadDevicesWithoutPermission]);

  useEffect(() => {
    const handleDeviceChange = () => {
      if (hasPermission) {
        loadDevicesWithPermission();
      } else {
        loadDevicesWithoutPermission();
      }
    };

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [hasPermission, loadDevicesWithPermission, loadDevicesWithoutPermission]);

  return {
    devices,
    loading,
    error,
    hasPermission,
    loadDevices: loadDevicesWithPermission,
  };
}
