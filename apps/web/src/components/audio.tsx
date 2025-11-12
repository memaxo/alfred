/**
 * Audio Player Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/audio-player
 * Wire to tRPC voice.ttsSynthesize for TTS playback
 */

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AudioProps = {
  src: string;
  autoPlay?: boolean;
  className?: string;
};

export function Audio({ src, autoPlay = false, className }: AudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;

    if (autoPlay) {
      audio.play().catch(() => {
        // Auto-play blocked by browser, ignore
      });
      setIsPlaying(true);
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

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
