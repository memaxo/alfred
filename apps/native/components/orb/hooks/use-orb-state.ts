/**
 * useOrbState Hook
 *
 * Maps voice session state to orb visualization props.
 * Provides a clean interface between the voice system and the orb component.
 */

import { useMemo } from "react";

import type { OrbState } from "../constants";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Voice stream status from the voice session
 */
type StreamStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "processing"
  | "playing"
  | "error";

/**
 * Input props from the voice session
 */
interface VoiceSessionState {
  /** Current status of the voice stream */
  status: StreamStatus;
  /** VAD confidence (0-1), null when not available */
  vadConfidence: number | null;
  /** Whether the stream is actively recording */
  isActive: boolean;
  /** Error message if status is 'error' */
  error: string | null;
}

/**
 * Output props for the Orb component
 */
interface OrbStateOutput {
  /** Mapped orb state */
  state: OrbState;
  /** Input volume for visualization */
  inputVolume: number;
  /** Output volume for visualization */
  outputVolume: number;
  /** Status label text */
  statusLabel: string;
  /** Whether the orb should show as active */
  isActive: boolean;
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

const STATUS_TO_ORB_STATE: Record<StreamStatus, OrbState> = {
  idle: "idle",
  connecting: "thinking",
  recording: "listening",
  processing: "thinking",
  playing: "speaking",
  error: "error",
};

const STATUS_LABELS: Record<StreamStatus, string> = {
  idle: "",
  connecting: "Connecting...",
  recording: "Listening...",
  processing: "Thinking...",
  playing: "",
  error: "Something went wrong",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Maps voice session state to orb visualization props
 *
 * @param voiceState - Current voice session state
 * @returns Props for the Orb component
 */
export function useOrbState(voiceState: VoiceSessionState): OrbStateOutput {
  const orbState = useMemo<OrbState>(
    () => STATUS_TO_ORB_STATE[voiceState.status] ?? "dormant",
    [voiceState.status]
  );

  const inputVolume = useMemo(() => {
    // VAD confidence maps directly to input volume
    if (
      voiceState.status === "recording" &&
      voiceState.vadConfidence !== null
    ) {
      return Math.min(1, Math.max(0, voiceState.vadConfidence));
    }
    return 0;
  }, [voiceState.status, voiceState.vadConfidence]);

  const outputVolume = useMemo(() => {
    // Output volume is high when playing (TTS)
    if (voiceState.status === "playing") {
      return 0.7; // Could be driven by actual audio analysis in the future
    }
    return 0;
  }, [voiceState.status]);

  const statusLabel = useMemo(() => {
    if (voiceState.status === "error" && voiceState.error) {
      return voiceState.error;
    }
    return STATUS_LABELS[voiceState.status] ?? "";
  }, [voiceState.status, voiceState.error]);

  return {
    state: orbState,
    inputVolume,
    outputVolume,
    statusLabel,
    isActive: voiceState.isActive,
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Create a mock voice state for testing/preview
 */
export function createMockVoiceState(
  overrides: Partial<VoiceSessionState> = {}
): VoiceSessionState {
  return {
    status: "idle",
    vadConfidence: null,
    isActive: false,
    error: null,
    ...overrides,
  };
}

/**
 * Cycle through states for demo purposes
 */
export function getNextDemoState(current: StreamStatus): StreamStatus {
  const sequence: StreamStatus[] = [
    "idle",
    "connecting",
    "recording",
    "processing",
    "playing",
    "idle",
  ];
  const currentIndex = sequence.indexOf(current);
  return sequence[(currentIndex + 1) % sequence.length];
}
