/**
 * Focus state machine operations
 */

import {
  FOCUS_MAX_DURATION,
  FOCUS_MIN_DURATION,
  type FocusStartParams,
  type FocusState,
  type FocusUpdateParams,
} from "./types.js";

function clampDuration(duration?: number) {
  if (!(duration && Number.isFinite(duration))) {
    return;
  }
  const rounded = Math.round(duration);
  if (rounded < FOCUS_MIN_DURATION) {
    return FOCUS_MIN_DURATION;
  }
  if (rounded > FOCUS_MAX_DURATION) {
    return FOCUS_MAX_DURATION;
  }
  return rounded;
}

function cleanNote(note?: string) {
  if (!note) {
    return;
  }
  const trimmed = note.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, 280);
}

export const statusFocus = (
  state: FocusState | null | undefined
): FocusState => {
  if (!state) {
    return { _: "idle" };
  }
  return {
    _: state._,
    since: state.since,
    duration: state.duration,
    note: state.note,
    sessions: state.sessions,
    last: state.last,
  };
};

export const startFocus = (
  current: FocusState | null | undefined,
  params: FocusStartParams
): FocusState => {
  const now = params.since ?? new Date().toISOString();
  const duration = clampDuration(params.durationMin ?? current?.duration);
  const note = cleanNote(params.note ?? current?.note);
  const sessions = (current?.sessions ?? 0) + 1;
  return {
    _: "active",
    since: now,
    duration,
    note,
    sessions,
    last: current?.last,
  };
};

export const stopFocus = (
  current: FocusState | null | undefined
): FocusState => {
  if (!current) {
    return { _: "idle" };
  }
  const timestamp = new Date().toISOString();
  const started = current.since ?? timestamp;
  const elapsedMs = Date.parse(timestamp) - Date.parse(started);
  const duration = Math.max(1, Math.round(elapsedMs / 60_000));
  return {
    _: "idle",
    duration: current.duration ?? duration,
    note: current.note,
    sessions: current.sessions,
    last: {
      started,
      stopped: timestamp,
      duration,
    },
  };
};

export const updateFocus = (
  current: FocusState | null | undefined,
  params: FocusUpdateParams
): FocusState => {
  const base = statusFocus(current);
  const duration =
    params.durationMin !== undefined
      ? clampDuration(params.durationMin)
      : base.duration;
  const note = params.note !== undefined ? cleanNote(params.note) : base.note;
  const since =
    base._ === "active"
      ? (base.since ?? params.timestamp ?? new Date().toISOString())
      : base.since;

  return {
    _: base._,
    since,
    duration,
    note,
    sessions: base.sessions,
    last: base.last,
  };
};
