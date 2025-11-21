/**
 * Mic Selector Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/mic-selector
 * Microphone input selection for voice recording
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MicDevice = {
  id: string;
  label: string;
};

type MicProps = {
  devices: MicDevice[];
  selected: string;
  onSelect: (deviceId: string) => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  className?: string;
};

export function Mic({
  devices,
  selected,
  onSelect,
  isRecording,
  onToggleRecord,
  className,
}: MicProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {devices.map((device) => (
          <Button
            key={device.id}
            onClick={() => onSelect(device.id)}
            size="sm"
            variant={selected === device.id ? "default" : "outline"}
          >
            {device.label}
          </Button>
        ))}
      </div>
      <Button
        className="w-full"
        onClick={onToggleRecord}
        size="lg"
        variant={isRecording ? "destructive" : "default"}
      >
        <Mic className="mr-2 size-4" />
        {isRecording ? "Stop Recording" : "Start Recording"}
      </Button>
    </div>
  );
}
