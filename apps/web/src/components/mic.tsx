/**
 * Mic Selector Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/mic-selector
 * Microphone input selection for voice recording
 */

import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicDevice {
  id: string;
  label: string;
}

interface MicProps {
  devices: MicDevice[];
  selected: string;
  onSelect: (deviceId: string) => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  className?: string;
}

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
            variant={selected === device.id ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(device.id)}
          >
            {device.label}
          </Button>
        ))}
      </div>
      <Button
        variant={isRecording ? "destructive" : "default"}
        size="lg"
        onClick={onToggleRecord}
        className="w-full"
      >
        <Mic className="size-4 mr-2" />
        {isRecording ? "Stop Recording" : "Start Recording"}
      </Button>
    </div>
  );
}

