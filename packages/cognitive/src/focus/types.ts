/**
 * Focus state types (productivity mode)
 */

export interface FocusState {
  _: "idle" | "active";
  since?: string;
  duration?: number;
  note?: string;
  sessions?: number;
  last?: {
    started: string;
    stopped: string;
    duration: number;
  };
}

export interface FocusStartParams {
  durationMin?: number;
  note?: string;
  since?: string;
}

export interface FocusUpdateParams {
  durationMin?: number;
  note?: string;
  timestamp?: string;
}

export const FOCUS_MIN_DURATION = 5;
export const FOCUS_MAX_DURATION = 12 * 60;
