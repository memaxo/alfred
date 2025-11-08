/**
 * Audio Player Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/audio-player
 * Wire to tRPC voice.ttsSynthesize for TTS playback
 */

import { Pause, Play, Volume2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
}

export function Audio({ src, autoPlay = false, className }: AudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => {
    const a = new Audio(src);
    a.onended = () => setIsPlaying(false);
    return a;
  });

  const togglePlay = () => {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={togglePlay}
        size="icon"
        variant="outline"
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Volume2 className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground text-sm">Audio</span>
    </div>
  );
}
