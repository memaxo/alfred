/**
 * ALFRED TUI Input Line Component
 *
 * Single-line text input with cursor, history navigation, and editing.
 */

import type { KeyEvent } from "../input/keys";
import { colors } from "../theme";
import { dim, fg, padRight, visibleLength } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InputLineState = {
  value: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
  placeholder: string;
};

export type InputLineActions = {
  setValue: (value: string) => void;
  insert: (char: string) => void;
  backspace: () => void;
  delete: () => void;
  moveCursorLeft: () => void;
  moveCursorRight: () => void;
  moveCursorStart: () => void;
  moveCursorEnd: () => void;
  historyPrev: () => void;
  historyNext: () => void;
  submit: () => string;
  clear: () => void;
};

// ─── State Factory ───────────────────────────────────────────────────────────

export function createInputLineState(
  placeholder = "Type here..."
): InputLineState {
  return {
    value: "",
    cursorPosition: 0,
    history: [],
    historyIndex: -1,
    placeholder,
  };
}

// ─── Actions Factory ─────────────────────────────────────────────────────────

export function createInputLineActions(
  getState: () => InputLineState,
  setState: (state: InputLineState) => void
): InputLineActions {
  return {
    setValue: (value: string) => {
      setState({
        ...getState(),
        value,
        cursorPosition: value.length,
        historyIndex: -1,
      });
    },

    insert: (char: string) => {
      const state = getState();
      const before = state.value.slice(0, state.cursorPosition);
      const after = state.value.slice(state.cursorPosition);
      setState({
        ...state,
        value: before + char + after,
        cursorPosition: state.cursorPosition + char.length,
        historyIndex: -1,
      });
    },

    backspace: () => {
      const state = getState();
      if (state.cursorPosition === 0) {
        return;
      }
      const before = state.value.slice(0, state.cursorPosition - 1);
      const after = state.value.slice(state.cursorPosition);
      setState({
        ...state,
        value: before + after,
        cursorPosition: state.cursorPosition - 1,
      });
    },

    delete: () => {
      const state = getState();
      if (state.cursorPosition >= state.value.length) {
        return;
      }
      const before = state.value.slice(0, state.cursorPosition);
      const after = state.value.slice(state.cursorPosition + 1);
      setState({
        ...state,
        value: before + after,
      });
    },

    moveCursorLeft: () => {
      const state = getState();
      if (state.cursorPosition > 0) {
        setState({
          ...state,
          cursorPosition: state.cursorPosition - 1,
        });
      }
    },

    moveCursorRight: () => {
      const state = getState();
      if (state.cursorPosition < state.value.length) {
        setState({
          ...state,
          cursorPosition: state.cursorPosition + 1,
        });
      }
    },

    moveCursorStart: () => {
      setState({
        ...getState(),
        cursorPosition: 0,
      });
    },

    moveCursorEnd: () => {
      const state = getState();
      setState({
        ...state,
        cursorPosition: state.value.length,
      });
    },

    historyPrev: () => {
      const state = getState();
      if (state.history.length === 0) {
        return;
      }
      const newIndex =
        state.historyIndex < state.history.length - 1
          ? state.historyIndex + 1
          : state.historyIndex;
      const value = state.history[newIndex] ?? "";
      setState({
        ...state,
        historyIndex: newIndex,
        value,
        cursorPosition: value.length,
      });
    },

    historyNext: () => {
      const state = getState();
      if (state.historyIndex <= 0) {
        setState({
          ...state,
          historyIndex: -1,
          value: "",
          cursorPosition: 0,
        });
        return;
      }
      const newIndex = state.historyIndex - 1;
      const value = state.history[newIndex] ?? "";
      setState({
        ...state,
        historyIndex: newIndex,
        value,
        cursorPosition: value.length,
      });
    },

    submit: () => {
      const state = getState();
      const value = state.value.trim();
      if (value) {
        // Add to history (avoid duplicates at top)
        const history =
          state.history[0] === value
            ? state.history
            : [value, ...state.history.slice(0, 99)];
        setState({
          ...state,
          value: "",
          cursorPosition: 0,
          history,
          historyIndex: -1,
        });
      }
      return value;
    },

    clear: () => {
      setState({
        ...getState(),
        value: "",
        cursorPosition: 0,
        historyIndex: -1,
      });
    },
  };
}

// ─── Key Handler ─────────────────────────────────────────────────────────────

export function handleInputLineKey(
  event: KeyEvent,
  actions: InputLineActions,
  onSubmit?: (value: string) => void
): boolean {
  // Submit on Enter
  if (event.key === "enter" && !event.shift) {
    const value = actions.submit();
    if (value && onSubmit) {
      onSubmit(value);
    }
    return true;
  }

  // Backspace
  if (event.key === "backspace") {
    actions.backspace();
    return true;
  }

  // Delete
  if (event.key === "delete") {
    actions.delete();
    return true;
  }

  // Cursor movement
  if (event.key === "left") {
    actions.moveCursorLeft();
    return true;
  }

  if (event.key === "right") {
    actions.moveCursorRight();
    return true;
  }

  if (event.key === "home" || (event.ctrl && event.key === "a")) {
    actions.moveCursorStart();
    return true;
  }

  if (event.key === "end" || (event.ctrl && event.key === "e")) {
    actions.moveCursorEnd();
    return true;
  }

  // History navigation
  if (event.key === "up") {
    actions.historyPrev();
    return true;
  }

  if (event.key === "down") {
    actions.historyNext();
    return true;
  }

  // Clear line
  if (event.ctrl && event.key === "u") {
    actions.clear();
    return true;
  }

  // Character input
  if (event.key.length === 1 && !event.ctrl && !event.alt) {
    actions.insert(event.key);
    return true;
  }

  return false;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export function renderInputLine(
  state: InputLineState,
  width: number,
  options: {
    prompt?: string;
    showCursor?: boolean;
  } = {}
): string {
  const { prompt = "> ", showCursor = true } = options;
  const promptText = fg(colors.primary)(prompt);
  const promptWidth = visibleLength(promptText);
  const availableWidth = width - promptWidth - 1;

  // Show placeholder if empty
  if (!(state.value || showCursor)) {
    return promptText + dim(state.placeholder);
  }

  // Calculate visible window
  let displayValue = state.value;
  let cursorPos = state.cursorPosition;

  // Handle overflow - scroll to keep cursor visible
  if (displayValue.length > availableWidth) {
    const scrollOffset = Math.max(0, cursorPos - availableWidth + 5);
    displayValue = displayValue.slice(scrollOffset);
    cursorPos -= scrollOffset;
  }

  // Truncate if still too long
  if (displayValue.length > availableWidth) {
    displayValue = displayValue.slice(0, availableWidth);
  }

  // Insert cursor
  if (showCursor) {
    const before = displayValue.slice(0, cursorPos);
    const after = displayValue.slice(cursorPos);
    const cursor = fg(colors.primary)("▌");
    displayValue = before + cursor + after;
  }

  return promptText + padRight(displayValue, availableWidth);
}
