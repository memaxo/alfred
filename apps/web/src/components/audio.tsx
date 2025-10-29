/**
 * Audio Player Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/audio-player
 * Wire to tRPC voice.ttsSynthesize for TTS playback
 */

import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
        variant="outline"
        size="icon"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Volume2 className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Audio</span>
    </div>
  );
}

