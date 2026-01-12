/**
 * Voice Picker Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/voice-picker
 * Select voice for TTS synthesis
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Voice = {
  id: string;
  name: string;
};

type VoiceProps = {
  voices: Voice[];
  selected: string;
  onSelect: (voiceId: string) => void;
  className?: string;
};

export function Voice({ voices, selected, onSelect, className }: VoiceProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {voices.map((voice) => (
        <Button
          key={voice.id}
          onClick={() => onSelect(voice.id)}
          size="sm"
          variant={selected === voice.id ? "default" : "outline"}
        >
          {voice.name}
        </Button>
      ))}
    </div>
  );
}
