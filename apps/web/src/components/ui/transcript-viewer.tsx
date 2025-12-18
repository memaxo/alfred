"use client";

import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel";
import { Pause, Play } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import {
  ScrubBarContainer,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
  ScrubBarTrack,
} from "@/components/ui/scrub-bar";
import {
  type SegmentComposer,
  type TranscriptSegment,
  type TranscriptWord as TranscriptWordType,
  type UseTranscriptViewerResult,
  useTranscriptViewer,
} from "@/hooks/use-transcript-viewer";
import { cn } from "@/lib/utils";

type TranscriptGap = Extract<TranscriptSegment, { kind: "gap" }>;

type TranscriptViewerContextValue = UseTranscriptViewerResult & {
  audioProps: Omit<ComponentPropsWithRef<"audio">, "children" | "src">;
};

const TranscriptViewerContext =
  createContext<TranscriptViewerContextValue | null>(null);

function useTranscriptViewerContext() {
  const context = useContext(TranscriptViewerContext);
  if (!context) {
    throw new Error(
      "useTranscriptViewerContext must be used within a TranscriptViewer"
    );
  }
  return context;
}

type TranscriptViewerProviderProps = {
  value: TranscriptViewerContextValue;
  children: ReactNode;
};

function TranscriptViewerProvider({
  value,
  children,
}: TranscriptViewerProviderProps) {
  return (
    <TranscriptViewerContext.Provider value={value}>
      {children}
    </TranscriptViewerContext.Provider>
  );
}

type AudioType =
  | "audio/mpeg"
  | "audio/wav"
  | "audio/ogg"
  | "audio/mp3"
  | "audio/m4a"
  | "audio/aac"
  | "audio/webm";

type TranscriptViewerContainerProps = {
  audioSrc: string;
  audioType: AudioType;
  alignment: CharacterAlignmentResponseModel;
  segmentComposer?: SegmentComposer;
  hideAudioTags?: boolean;
  children?: ReactNode;
  onTimeUpdate?: (time: number) => void;
  onSegmentChange?: (index: number) => void;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "onTimeUpdate">;

function TranscriptViewerContainer({
  audioSrc,
  audioType = "audio/mpeg",
  alignment,
  segmentComposer,
  hideAudioTags = true,
  children,
  className,
  onTimeUpdate,
  onSegmentChange,
  ...props
}: TranscriptViewerContainerProps) {
  const initialSegments = useMemo(
    () => alignmentToSegments(alignment, segmentComposer),
    [alignment, segmentComposer]
  );

  const viewerState = useTranscriptViewer({
    onTimeUpdate,
    onSegmentChange,
    initialSegments,
    audioSrc,
  });

  const { audioRef } = viewerState;

  const audioProps = useMemo(
    () => ({
      ref: audioRef,
      controls: false,
      preload: "metadata" as const,
      src: audioSrc,
      children: <source src={audioSrc} type={audioType} />,
    }),
    [audioRef, audioSrc, audioType]
  );

  const contextValue = useMemo(
    () => ({
      ...viewerState,
      audioProps,
    }),
    [viewerState, audioProps]
  );

  return (
    <TranscriptViewerProvider value={contextValue}>
      <div
        className={cn("space-y-4 p-4", className)}
        data-slot="transcript-viewer-root"
        {...props}
      >
        {children}
      </div>
    </TranscriptViewerProvider>
  );
}

type TranscriptViewerWordStatus = "spoken" | "unspoken" | "current";
interface TranscriptViewerWordProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  word: TranscriptWordType;
  status: TranscriptViewerWordStatus;
  children?: ReactNode;
}

function TranscriptViewerWord({
  word,
  status,
  className,
  children,
  ...props
}: TranscriptViewerWordProps) {
  return (
    <span
      className={cn(
        "rounded-sm px-0.5 transition-colors",
        status === "spoken" && "text-foreground",
        status === "unspoken" && "text-muted-foreground",
        status === "current" && "bg-primary text-primary-foreground",
        className
      )}
      data-kind="word"
      data-slot="transcript-word"
      data-status={status}
      {...props}
    >
      {children ?? word.text}
    </span>
  );
}

interface TranscriptViewerWordsProps extends HTMLAttributes<HTMLDivElement> {
  renderWord?: (props: {
    word: TranscriptWordType;
    status: TranscriptViewerWordStatus;
  }) => ReactNode;
  renderGap?: (props: {
    segment: TranscriptGap;
    status: TranscriptViewerWordStatus;
  }) => ReactNode;
  wordClassNames?: string;
  gapClassNames?: string;
}

function TranscriptViewerWords({
  className,
  renderWord,
  renderGap,
  wordClassNames,
  gapClassNames,
  ...props
}: TranscriptViewerWordsProps) {
  const { currentWord, segments, duration, currentTime } =
    useTranscriptViewerContext();

  const nearEnd = useMemo(() => {
    if (!duration) {
      return false;
    }
    return currentTime >= duration - 0.01;
  }, [currentTime, duration]);

  type WordOrGap =
    | {
        kind: "gap";
        segment: TranscriptGap;
        status: TranscriptViewerWordStatus;
      }
    | {
        kind: "word";
        word: TranscriptWordType;
        status: TranscriptViewerWordStatus;
      };

  const segmentsWithStatus = useMemo(() => {
    if (nearEnd) {
      const entries: WordOrGap[] = [];
      for (const segment of segments) {
        if (segment.kind === "gap") {
          entries.push({ kind: "gap", segment, status: "spoken" });
          continue;
        }
        for (const word of segment.words) {
          entries.push({ kind: "word", word, status: "spoken" });
        }
      }
      return entries;
    }

    const entries: WordOrGap[] = [];
    const currentWordId = currentWord?.id ?? null;

    for (const segment of segments) {
      if (segment.kind === "gap") {
        const status: TranscriptViewerWordStatus =
          segment.end <= currentTime ? "spoken" : "unspoken";
        entries.push({ kind: "gap", segment, status });
        continue;
      }

      for (const word of segment.words) {
        const status: TranscriptViewerWordStatus =
          currentWordId && word.id === currentWordId
            ? "current"
            : word.end <= currentTime
              ? "spoken"
              : "unspoken";
        entries.push({ kind: "word", word, status });
      }
    }

    return entries;
  }, [currentTime, currentWord?.id, nearEnd, segments]);

  return (
    <div
      className={cn("text-xl leading-relaxed", className)}
      data-slot="transcript-words"
      {...props}
    >
      {segmentsWithStatus.map((entry) => {
        if (entry.kind === "gap") {
          const { segment, status } = entry;
          const content = renderGap
            ? renderGap({ segment, status })
            : segment.text;
          return (
            <span
              className={cn(gapClassNames)}
              data-kind="gap"
              data-status={status}
              key={`gap-${segment.segmentIndex ?? `${segment.start}-${segment.end}`}`}
            >
              {content}
            </span>
          );
        }

        const { word, status } = entry;
        if (renderWord) {
          return (
            <span
              className={cn(wordClassNames)}
              data-kind="word"
              data-status={status}
              key={`word-${word.id}`}
            >
              {renderWord({ word, status })}
            </span>
          );
        }

        return (
          <TranscriptViewerWord
            className={wordClassNames}
            key={`word-${word.id}`}
            status={status}
            word={word}
          />
        );
      })}
    </div>
  );
}

function TranscriptViewerAudio({
  ...props
}: ComponentPropsWithoutRef<"audio">) {
  const { audioProps } = useTranscriptViewerContext();
  return (
    <audio
      data-slot="transcript-audio"
      {...audioProps}
      {...props}
      ref={audioProps.ref}
    />
  );
}

type RenderChildren = (state: { isPlaying: boolean }) => ReactNode;

type TranscriptViewerPlayPauseButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "children"
> & {
  children?: ReactNode | RenderChildren;
};

function TranscriptViewerPlayPauseButton({
  className,
  children,
  onClick,
  ...props
}: TranscriptViewerPlayPauseButtonProps) {
  const { isPlaying, play, pause } = useTranscriptViewerContext();
  const Icon = isPlaying ? Pause : Play;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    onClick?.(event);
  };

  const content =
    typeof children === "function"
      ? (children as RenderChildren)({ isPlaying })
      : children;

  return (
    <Button
      aria-label={isPlaying ? "Pause audio" : "Play audio"}
      className={cn("cursor-pointer", className)}
      data-playing={isPlaying}
      data-slot="transcript-play-pause-button"
      onClick={handleClick}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {content ?? <Icon className="size-5" />}
    </Button>
  );
}

type TranscriptViewerScrubBarProps = Omit<
  ComponentPropsWithoutRef<typeof ScrubBarContainer>,
  "duration" | "value" | "onScrub" | "onScrubStart" | "onScrubEnd"
> & {
  showTimeLabels?: boolean;
  labelsClassName?: string;
  trackClassName?: string;
  progressClassName?: string;
  thumbClassName?: string;
};

/**
 * A context-aware implementation of the scrub bar specific to the transcript viewer.
 */
function TranscriptViewerScrubBar({
  className,
  showTimeLabels = true,
  labelsClassName,
  trackClassName,
  progressClassName,
  thumbClassName,
  ...props
}: TranscriptViewerScrubBarProps) {
  const { duration, currentTime, seekToTime, startScrubbing, endScrubbing } =
    useTranscriptViewerContext();
  return (
    <ScrubBarContainer
      className={className}
      data-slot="transcript-scrub-bar"
      duration={duration}
      onScrub={seekToTime}
      onScrubEnd={endScrubbing}
      onScrubStart={startScrubbing}
      value={currentTime}
      {...props}
    >
      <div className="flex flex-1 flex-col gap-1">
        <ScrubBarTrack className={trackClassName}>
          <ScrubBarProgress className={progressClassName} />
          <ScrubBarThumb className={thumbClassName} />
        </ScrubBarTrack>
        {showTimeLabels && (
          <div
            className={cn(
              "flex items-center justify-between text-muted-foreground text-xs",
              labelsClassName
            )}
          >
            <ScrubBarTimeLabel time={currentTime} />
            <ScrubBarTimeLabel time={duration - currentTime} />
          </div>
        )}
      </div>
    </ScrubBarContainer>
  );
}

export {
  TranscriptViewerContainer,
  TranscriptViewerWords,
  TranscriptViewerWord,
  TranscriptViewerAudio,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
  TranscriptViewerProvider,
  useTranscriptViewerContext,
};
export type { CharacterAlignmentResponseModel };

function isAlignmentArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function alignmentToSegments(
  alignment: CharacterAlignmentResponseModel,
  composer?: SegmentComposer
): TranscriptSegment[] {
  if (composer) {
    return composer.segments;
  }

  const raw = alignment as unknown as Record<string, unknown>;
  const characters = raw.characters;
  const starts = raw.character_start_times_seconds;
  const ends = raw.character_end_times_seconds;

  if (
    !(
      isAlignmentArray(characters) &&
      isAlignmentArray(starts) &&
      isAlignmentArray(ends)
    )
  ) {
    return [];
  }

  const words: TranscriptWordType[] = [];
  let buffer = "";
  let wordStart: number | null = null;
  let wordEnd: number | null = null;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const start = starts[i];
    const end = ends[i];
    if (
      !(
        typeof ch === "string" &&
        typeof start === "number" &&
        typeof end === "number"
      )
    ) {
      continue;
    }

    const isSpace = ch.trim() === "";
    if (isSpace) {
      if (buffer.length > 0 && wordStart !== null && wordEnd !== null) {
        words.push({
          id: `${words.length}`,
          text: buffer,
          start: wordStart,
          end: wordEnd,
        });
      }
      buffer = "";
      wordStart = null;
      wordEnd = null;
      continue;
    }

    if (buffer.length === 0) {
      wordStart = start;
    }
    buffer += ch;
    wordEnd = end;
  }

  if (buffer.length > 0 && wordStart !== null && wordEnd !== null) {
    words.push({
      id: `${words.length}`,
      text: buffer,
      start: wordStart,
      end: wordEnd,
    });
  }

  if (words.length === 0) {
    return [];
  }

  const start = words[0]?.start ?? 0;
  const end = words.at(-1)?.end ?? start;

  return [
    {
      kind: "speaker",
      speaker: "Speaker",
      start,
      end,
      words,
      segmentIndex: 0,
    },
  ];
}
