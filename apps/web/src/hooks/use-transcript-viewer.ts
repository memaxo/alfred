/**
 * Transcript Viewer Hook
 *
 * Manages transcript playback, segment tracking, and audio synchronization.
 * Stub implementation - to be fully implemented when voice transcription is complete.
 */

import { useCallback, useMemo, useRef, useState } from "react";

export type TranscriptWord = {
  id: string;
  text: string;
  start: number;
  end: number;
  confidence?: number;
};

export type TranscriptSegment =
  | {
      kind: "speaker";
      speaker: string;
      start: number;
      end: number;
      words: TranscriptWord[];
      segmentIndex?: number;
    }
  | {
      kind: "gap";
      start: number;
      end: number;
      text?: string;
      segmentIndex?: number;
    };

export type SegmentComposer = {
  segments: TranscriptSegment[];
  addWord: (word: TranscriptWord, speaker: string) => void;
  finalize: () => TranscriptSegment[];
};

export type TranscriptViewerStatus = "idle" | "playing" | "paused" | "loading";

export type UseTranscriptViewerResult = {
  segments: TranscriptSegment[];
  currentTime: number;
  duration: number;
  status: TranscriptViewerStatus;
  activeSegmentIndex: number | null;
  activeWordIndex: number | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSegments: (segments: TranscriptSegment[]) => void;
  // Extended properties for full component compatibility
  audioRef: React.RefObject<HTMLAudioElement | null>;
  spokenSegments: TranscriptSegment[];
  unspokenSegments: TranscriptSegment[];
  currentWord: TranscriptWord | null;
  isPlaying: boolean;
  seekToTime: (time: number) => void;
  startScrubbing: () => void;
  endScrubbing: () => void;
};

export type UseTranscriptViewerOptions = {
  audioSrc?: string;
  initialSegments?: TranscriptSegment[];
  onTimeUpdate?: (time: number) => void;
  onSegmentChange?: (index: number) => void;
};

export function useTranscriptViewer(
  options: UseTranscriptViewerOptions = {}
): UseTranscriptViewerResult {
  const { initialSegments = [], onTimeUpdate: _onTimeUpdate, onSegmentChange } = options;

  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState<TranscriptViewerStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const duration = useMemo(() => {
    if (segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    return lastSegment?.end ?? 0;
  }, [segments]);

  const { activeSegmentIndex, activeWordIndex } = useMemo(() => {
    let segIdx: number | null = null;
    let wordIdx: number | null = null;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg) continue;
      if (currentTime >= seg.start && currentTime <= seg.end) {
        segIdx = i;
        if (seg.kind === "speaker") {
          for (let j = 0; j < seg.words.length; j++) {
            const word = seg.words[j];
            if (word && currentTime >= word.start && currentTime <= word.end) {
              wordIdx = j;
              break;
            }
          }
        }
        break;
      }
    }

    return { activeSegmentIndex: segIdx, activeWordIndex: wordIdx };
  }, [segments, currentTime]);

  const play = useCallback(() => {
    audioRef.current?.play();
    setStatus("playing");
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus("paused");
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  // Notify on segment change
  useMemo(() => {
    if (activeSegmentIndex !== null) {
      onSegmentChange?.(activeSegmentIndex);
    }
  }, [activeSegmentIndex, onSegmentChange]);

  // Computed segments
  const { spokenSegments, unspokenSegments, currentWord } = useMemo(() => {
    const spoken: TranscriptSegment[] = [];
    const unspoken: TranscriptSegment[] = [];
    let word: TranscriptWord | null = null;

    for (const seg of segments) {
      if (seg.end <= currentTime) {
        spoken.push(seg);
      } else if (seg.start > currentTime) {
        unspoken.push(seg);
      } else {
        // Current segment
        if (seg.kind === "speaker" && activeWordIndex !== null) {
          word = seg.words[activeWordIndex] ?? null;
        }
      }
    }

    return { spokenSegments: spoken, unspokenSegments: unspoken, currentWord: word };
  }, [segments, currentTime, activeWordIndex]);

  const isPlaying = status === "playing";

  const seekToTime = useCallback((time: number) => {
    seek(time);
  }, [seek]);

  const [_isScrubbing, setIsScrubbing] = useState(false);
  const startScrubbing = useCallback(() => setIsScrubbing(true), []);
  const endScrubbing = useCallback(() => setIsScrubbing(false), []);

  return {
    segments,
    currentTime,
    duration,
    status,
    activeSegmentIndex,
    activeWordIndex,
    play,
    pause,
    seek,
    setSegments,
    audioRef,
    spokenSegments,
    unspokenSegments,
    currentWord,
    isPlaying,
    seekToTime,
    startScrubbing,
    endScrubbing,
  };
}

export function createSegmentComposer(): SegmentComposer {
  const segments: TranscriptSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentWords: TranscriptWord[] = [];
  let segmentStart = 0;

  return {
    get segments() {
      return segments;
    },
    addWord(word: TranscriptWord, speaker: string) {
      if (currentSpeaker !== speaker && currentWords.length > 0) {
        // Finalize previous segment
        const lastWord = currentWords[currentWords.length - 1];
        segments.push({
          kind: "speaker",
          speaker: currentSpeaker!,
          start: segmentStart,
          end: lastWord?.end ?? segmentStart,
          words: currentWords,
        });
        currentWords = [];
        segmentStart = word.start;
      }
      currentSpeaker = speaker;
      currentWords.push(word);
    },
    finalize() {
      if (currentWords.length > 0 && currentSpeaker) {
        const lastWord = currentWords[currentWords.length - 1];
        segments.push({
          kind: "speaker",
          speaker: currentSpeaker,
          start: segmentStart,
          end: lastWord?.end ?? segmentStart,
          words: currentWords,
        });
      }
      return segments;
    },
  };
}
