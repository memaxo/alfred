/**
 * ALFRED TUI Vim-like Motions
 *
 * Vim-style navigation for scrollable content within panels.
 */

import type { KeyEvent } from "./keys";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScrollState = {
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
  cursorLine: number;
  totalLines: number;
};

export type ScrollActions = {
  scrollUp: (lines?: number) => void;
  scrollDown: (lines?: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  pageUp: () => void;
  pageDown: () => void;
  halfPageUp: () => void;
  halfPageDown: () => void;
  cursorUp: () => void;
  cursorDown: () => void;
  cursorToTop: () => void;
  cursorToBottom: () => void;
};

// ─── Scroll State ────────────────────────────────────────────────────────────

export function createScrollState(
  totalLines: number,
  viewportHeight: number
): ScrollState {
  return {
    scrollTop: 0,
    scrollHeight: Math.max(0, totalLines - viewportHeight),
    viewportHeight,
    cursorLine: 0,
    totalLines,
  };
}

export function updateScrollState(
  state: ScrollState,
  totalLines: number,
  viewportHeight: number
): ScrollState {
  const scrollHeight = Math.max(0, totalLines - viewportHeight);
  const scrollTop = Math.min(state.scrollTop, scrollHeight);
  const cursorLine = Math.min(state.cursorLine, totalLines - 1);

  return {
    ...state,
    scrollHeight,
    scrollTop,
    viewportHeight,
    totalLines,
    cursorLine: Math.max(0, cursorLine),
  };
}

// ─── Scroll Actions ──────────────────────────────────────────────────────────

export function createScrollActions(
  getState: () => ScrollState,
  setState: (state: ScrollState) => void
): ScrollActions {
  const clampScroll = (value: number, state: ScrollState): number =>
    Math.max(0, Math.min(value, state.scrollHeight));

  const clampCursor = (value: number, state: ScrollState): number =>
    Math.max(0, Math.min(value, state.totalLines - 1));

  const ensureCursorVisible = (state: ScrollState): ScrollState => {
    let { scrollTop } = state;
    const { cursorLine, viewportHeight } = state;

    // Cursor above viewport
    if (cursorLine < scrollTop) {
      scrollTop = cursorLine;
    }
    // Cursor below viewport
    else if (cursorLine >= scrollTop + viewportHeight) {
      scrollTop = cursorLine - viewportHeight + 1;
    }

    return { ...state, scrollTop: clampScroll(scrollTop, state) };
  };

  return {
    scrollUp: (lines = 1) => {
      const state = getState();
      const newScrollTop = clampScroll(state.scrollTop - lines, state);
      setState({ ...state, scrollTop: newScrollTop });
    },

    scrollDown: (lines = 1) => {
      const state = getState();
      const newScrollTop = clampScroll(state.scrollTop + lines, state);
      setState({ ...state, scrollTop: newScrollTop });
    },

    scrollToTop: () => {
      const state = getState();
      setState({ ...state, scrollTop: 0 });
    },

    scrollToBottom: () => {
      const state = getState();
      setState({ ...state, scrollTop: state.scrollHeight });
    },

    pageUp: () => {
      const state = getState();
      const newScrollTop = clampScroll(
        state.scrollTop - state.viewportHeight,
        state
      );
      setState({ ...state, scrollTop: newScrollTop });
    },

    pageDown: () => {
      const state = getState();
      const newScrollTop = clampScroll(
        state.scrollTop + state.viewportHeight,
        state
      );
      setState({ ...state, scrollTop: newScrollTop });
    },

    halfPageUp: () => {
      const state = getState();
      const halfPage = Math.floor(state.viewportHeight / 2);
      const newScrollTop = clampScroll(state.scrollTop - halfPage, state);
      setState({ ...state, scrollTop: newScrollTop });
    },

    halfPageDown: () => {
      const state = getState();
      const halfPage = Math.floor(state.viewportHeight / 2);
      const newScrollTop = clampScroll(state.scrollTop + halfPage, state);
      setState({ ...state, scrollTop: newScrollTop });
    },

    cursorUp: () => {
      const state = getState();
      const newCursor = clampCursor(state.cursorLine - 1, state);
      const newState = { ...state, cursorLine: newCursor };
      setState(ensureCursorVisible(newState));
    },

    cursorDown: () => {
      const state = getState();
      const newCursor = clampCursor(state.cursorLine + 1, state);
      const newState = { ...state, cursorLine: newCursor };
      setState(ensureCursorVisible(newState));
    },

    cursorToTop: () => {
      const state = getState();
      setState(ensureCursorVisible({ ...state, cursorLine: 0 }));
    },

    cursorToBottom: () => {
      const state = getState();
      const lastLine = state.totalLines - 1;
      setState(ensureCursorVisible({ ...state, cursorLine: lastLine }));
    },
  };
}

// ─── Vim Key Handler ─────────────────────────────────────────────────────────

export type VimKeyHandlerOptions = {
  enableCursor?: boolean;
  enableScroll?: boolean;
  enableGg?: boolean;
};

export function createVimKeyHandler(
  actions: ScrollActions,
  options: VimKeyHandlerOptions = {}
): (event: KeyEvent) => boolean {
  const { enableCursor = true, enableScroll = true, enableGg = true } = options;

  let lastKey = "";
  let lastKeyTime = 0;

  return (event: KeyEvent) => {
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTime;

    // Cursor movement (j/k)
    if (enableCursor) {
      if (event.key === "j") {
        actions.cursorDown();
        lastKey = "";
        return true;
      }
      if (event.key === "k") {
        actions.cursorUp();
        lastKey = "";
        return true;
      }
    }

    // Scroll without moving cursor
    if (enableScroll) {
      if (event.ctrl && event.key === "d") {
        actions.halfPageDown();
        lastKey = "";
        return true;
      }
      if (event.ctrl && event.key === "u") {
        actions.halfPageUp();
        lastKey = "";
        return true;
      }
      if (event.ctrl && event.key === "f") {
        actions.pageDown();
        lastKey = "";
        return true;
      }
      if (event.ctrl && event.key === "b") {
        actions.pageUp();
        lastKey = "";
        return true;
      }
    }

    // gg to go to top (two key sequence)
    if (enableGg && event.key === "g") {
      if (lastKey === "g" && timeSinceLastKey < 500) {
        actions.cursorToTop();
        lastKey = "";
        return true;
      }
      lastKey = "g";
      lastKeyTime = now;
      return true;
    }

    // G to go to bottom
    if (event.key === "G" || (event.shift && event.key === "g")) {
      actions.cursorToBottom();
      lastKey = "";
      return true;
    }

    lastKey = "";
    return false;
  };
}

// ─── Visible Lines Helper ────────────────────────────────────────────────────

export function getVisibleLines<T>(
  lines: T[],
  state: ScrollState
): { line: T; index: number; isCursor: boolean }[] {
  const result: { line: T; index: number; isCursor: boolean }[] = [];

  for (let i = 0; i < state.viewportHeight; i++) {
    const lineIndex = state.scrollTop + i;
    const line = lines[lineIndex];
    if (line !== undefined) {
      result.push({
        line,
        index: lineIndex,
        isCursor: lineIndex === state.cursorLine,
      });
    }
  }

  return result;
}

// ─── Scroll Indicator ────────────────────────────────────────────────────────

export function getScrollIndicator(state: ScrollState): {
  position: number; // 0-1, position in scroll range
  canScrollUp: boolean;
  canScrollDown: boolean;
} {
  const position =
    state.scrollHeight > 0 ? state.scrollTop / state.scrollHeight : 0;
  const canScrollUp = state.scrollTop > 0;
  const canScrollDown = state.scrollTop < state.scrollHeight;

  return { position, canScrollUp, canScrollDown };
}
