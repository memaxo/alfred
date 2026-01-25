import { describe, expect, it } from "bun:test";

import {
  startFocus,
  statusFocus,
  stopFocus,
  updateFocus,
} from "../src/focus/machine";
import {
  FOCUS_MAX_DURATION,
  FOCUS_MIN_DURATION,
  type FocusState,
} from "../src/focus/types";

describe("statusFocus", () => {
  it("returns idle state for null input", () => {
    expect(statusFocus(null)).toEqual({ _: "idle" });
  });

  it("returns idle state for undefined input", () => {
    expect(statusFocus()).toEqual({ _: "idle" });
  });

  it("copies all fields from existing state", () => {
    const state: FocusState = {
      _: "active",
      since: "2024-01-01T10:00:00Z",
      duration: 25,
      note: "Deep work",
      sessions: 3,
      last: {
        started: "2024-01-01T09:00:00Z",
        stopped: "2024-01-01T09:25:00Z",
        duration: 25,
      },
    };

    const result = statusFocus(state);
    expect(result).toEqual(state);
  });
});

describe("startFocus", () => {
  it("creates active state with provided since timestamp", () => {
    const result = startFocus(null, { since: "2024-01-01T10:00:00Z" });
    expect(result._).toBe("active");
    expect(result.since).toBe("2024-01-01T10:00:00Z");
    expect(result.sessions).toBe(1);
  });

  it("increments session count from previous state", () => {
    const previous: FocusState = { _: "idle", sessions: 5 };
    const result = startFocus(previous, {});
    expect(result.sessions).toBe(6);
  });

  it("clamps duration to minimum", () => {
    const result = startFocus(null, { durationMin: 2 });
    expect(result.duration).toBe(FOCUS_MIN_DURATION);
  });

  it("clamps duration to maximum", () => {
    const result = startFocus(null, { durationMin: 1000 });
    expect(result.duration).toBe(FOCUS_MAX_DURATION);
  });

  it("rounds duration to nearest integer", () => {
    const result = startFocus(null, { durationMin: 25.7 });
    expect(result.duration).toBe(26);
  });

  it("preserves note from previous state if not provided", () => {
    const previous: FocusState = { _: "idle", note: "Previous note" };
    const result = startFocus(previous, {});
    expect(result.note).toBe("Previous note");
  });

  it("uses new note when provided", () => {
    const previous: FocusState = { _: "idle", note: "Previous note" };
    const result = startFocus(previous, { note: "New note" });
    expect(result.note).toBe("New note");
  });

  it("trims and truncates note to 280 characters", () => {
    const longNote = "a".repeat(300);
    const result = startFocus(null, { note: longNote });
    expect(result.note?.length).toBe(280);
  });

  it("cleans empty notes to undefined", () => {
    const result = startFocus(null, { note: "   " });
    expect(result.note).toBeUndefined();
  });

  it("preserves last session info", () => {
    const previous: FocusState = {
      _: "idle",
      last: {
        started: "2024-01-01T09:00:00Z",
        stopped: "2024-01-01T09:25:00Z",
        duration: 25,
      },
    };
    const result = startFocus(previous, {});
    expect(result.last).toEqual(previous.last);
  });
});

describe("stopFocus", () => {
  it("returns idle for null input", () => {
    expect(stopFocus(null)).toEqual({ _: "idle" });
  });

  it("transitions active to idle", () => {
    const active: FocusState = {
      _: "active",
      since: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
      duration: 25,
    };
    const result = stopFocus(active);
    expect(result._).toBe("idle");
  });

  it("preserves duration and note", () => {
    const active: FocusState = {
      _: "active",
      since: new Date().toISOString(),
      duration: 30,
      note: "Focus session",
    };
    const result = stopFocus(active);
    expect(result.duration).toBe(30);
    expect(result.note).toBe("Focus session");
  });

  it("preserves session count", () => {
    const active: FocusState = {
      _: "active",
      since: new Date().toISOString(),
      sessions: 5,
    };
    const result = stopFocus(active);
    expect(result.sessions).toBe(5);
  });

  it("records last session with calculated duration", () => {
    const startTime = new Date(Date.now() - 120_000).toISOString(); // 2 minutes ago
    const active: FocusState = {
      _: "active",
      since: startTime,
    };
    const result = stopFocus(active);
    expect(result.last).toBeDefined();
    expect(result.last?.started).toBe(startTime);
    expect(result.last?.duration).toBeGreaterThanOrEqual(1);
  });

  it("uses calculated duration when state duration not set", () => {
    const startTime = new Date(Date.now() - 180_000).toISOString(); // 3 minutes ago
    const active: FocusState = {
      _: "active",
      since: startTime,
    };
    const result = stopFocus(active);
    // Duration should be ~3 minutes
    expect(result.duration).toBeGreaterThanOrEqual(2);
    expect(result.duration).toBeLessThanOrEqual(4);
  });
});

describe("updateFocus", () => {
  it("returns idle for null input with no params", () => {
    const result = updateFocus(null, {});
    expect(result._).toBe("idle");
  });

  it("updates duration when provided", () => {
    const state: FocusState = { _: "idle", duration: 25 };
    const result = updateFocus(state, { durationMin: 45 });
    expect(result.duration).toBe(45);
  });

  it("clamps updated duration to bounds", () => {
    const state: FocusState = { _: "idle" };
    expect(updateFocus(state, { durationMin: 1 }).duration).toBe(
      FOCUS_MIN_DURATION
    );
    expect(updateFocus(state, { durationMin: 2000 }).duration).toBe(
      FOCUS_MAX_DURATION
    );
  });

  it("updates note when provided", () => {
    const state: FocusState = { _: "idle", note: "Old note" };
    const result = updateFocus(state, { note: "New note" });
    expect(result.note).toBe("New note");
  });

  it("clears note when set to empty string", () => {
    const state: FocusState = { _: "idle", note: "Old note" };
    const result = updateFocus(state, { note: "" });
    expect(result.note).toBeUndefined();
  });

  it("preserves existing fields when not updating", () => {
    const state: FocusState = {
      _: "active",
      since: "2024-01-01T10:00:00Z",
      duration: 25,
      note: "Focus",
      sessions: 3,
    };
    const result = updateFocus(state, {});
    expect(result.duration).toBe(25);
    expect(result.note).toBe("Focus");
    expect(result.sessions).toBe(3);
  });

  it("preserves since for active state", () => {
    const state: FocusState = {
      _: "active",
      since: "2024-01-01T10:00:00Z",
    };
    const result = updateFocus(state, { durationMin: 30 });
    expect(result.since).toBe("2024-01-01T10:00:00Z");
  });

  it("does not set since for idle state", () => {
    const state: FocusState = { _: "idle" };
    const result = updateFocus(state, { durationMin: 30 });
    expect(result.since).toBeUndefined();
  });
});

describe("focus session lifecycle", () => {
  it("complete session: start -> update -> stop", () => {
    let state: FocusState | null = null;

    // Start session
    state = startFocus(state, {
      since: "2024-01-01T10:00:00Z",
      durationMin: 25,
      note: "Deep work",
    });
    expect(state._).toBe("active");
    expect(state.sessions).toBe(1);

    // Update during session
    state = updateFocus(state, { note: "Updated focus goal" });
    expect(state.note).toBe("Updated focus goal");
    expect(state._).toBe("active");

    // Stop session
    state = stopFocus(state);
    expect(state._).toBe("idle");
    expect(state.sessions).toBe(1);
    expect(state.last).toBeDefined();

    // Start new session
    state = startFocus(state, { since: "2024-01-01T11:00:00Z" });
    expect(state.sessions).toBe(2);
    expect(state.last).toBeDefined(); // Previous session preserved
  });
});
