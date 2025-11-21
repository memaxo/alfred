"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Play, Pause } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";

interface VoiceSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function VoiceSelector({
  value,
  onValueChange,
  className,
}: VoiceSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [playingVoice, setPlayingVoice] = React.useState<string | null>(null);
  const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);

  const voicesQuery = trpc.voice.listVoices.useQuery();
  const previewMutation = trpc.voice.previewVoice.useMutation();

  const voices = voicesQuery.data ?? [];
  const selectedVoice = voices.find((v) => v.id === value) ?? (value ? { id: value, name: value } : null);

  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, [audioElement]);

  const handlePlayPreview = async (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();

    if (playingVoice === voiceId && audioElement) {
      audioElement.pause();
      setPlayingVoice(null);
      return;
    }

    // Stop current audio if any
    if (audioElement) {
      audioElement.pause();
    }

    try {
      setPlayingVoice(voiceId); // Show loading/playing state
      
      const result = await previewMutation.mutateAsync({
        voice: voiceId,
        text: "Hello, this is a preview of my voice.",
      });

      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      setAudioElement(audio);
      
      audio.onended = () => {
        setPlayingVoice(null);
      };
      
      audio.onerror = () => {
        setPlayingVoice(null);
        toast.error("Failed to play audio preview");
      };

      await audio.play();
    } catch (error) {
      setPlayingVoice(null);
      toast.error("Failed to load voice preview");
    }
  };

  const isLoading = voicesQuery.isLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={isLoading}
        >
          {selectedVoice ? (
            <span className="truncate">{selectedVoice.name}</span>
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Loading voices..." : "Select a voice..."}
            </span>
          )}
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search voices..." />
          <CommandList>
            <CommandEmpty>No voice found.</CommandEmpty>
            <CommandGroup>
              {voices.map((voice) => (
                <CommandItem
                  key={voice.id}
                  value={voice.id}
                  keywords={[voice.name]}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => handlePlayPreview(e, voice.id)}
                    disabled={previewMutation.isPending && playingVoice === voice.id && !audioElement}
                  >
                    {playingVoice === voice.id ? (
                       audioElement && !audioElement.paused ? (
                         <Pause className="h-3 w-3" />
                       ) : (
                         <Loader2 className="h-3 w-3 animate-spin" />
                       )
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span className="sr-only">Preview {voice.name}</span>
                  </Button>
                  <span className="flex-1 truncate">{voice.name}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === voice.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
