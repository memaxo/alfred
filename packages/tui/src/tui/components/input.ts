import type { KeyEvent } from "../input/keys";

export type InputLineState = {
  value: string;
  cursorPosition: number;
  placeholder: string;
  history: string[];
  historyIndex: number | null;
};

export function createInputLineState(placeholder = ""): InputLineState {
  return {
    value: "",
    cursorPosition: 0,
    placeholder,
    history: [],
    historyIndex: null,
  };
}

export function createInputLineActions(
  get: () => InputLineState,
  set: (next: InputLineState) => void
): {
  insert: (text: string) => void;
  backspace: () => void;
  moveCursorLeft: () => void;
  moveCursorRight: () => void;
  moveCursorStart: () => void;
  moveCursorEnd: () => void;
  submit: () => string;
  historyPrev: () => void;
  historyNext: () => void;
} {
  const update = (fn: (prev: InputLineState) => InputLineState) => {
    set(fn(get()));
  };

  return {
    insert: (text) => {
      if (!text) {
        return;
      }
      update((prev) => {
        const before = prev.value.slice(0, prev.cursorPosition);
        const after = prev.value.slice(prev.cursorPosition);
        const nextValue = before + text + after;
        return {
          ...prev,
          value: nextValue,
          cursorPosition: prev.cursorPosition + text.length,
          historyIndex: null,
        };
      });
    },

    backspace: () => {
      update((prev) => {
        if (prev.cursorPosition <= 0) {
          return prev;
        }
        const before = prev.value.slice(0, prev.cursorPosition - 1);
        const after = prev.value.slice(prev.cursorPosition);
        return {
          ...prev,
          value: before + after,
          cursorPosition: prev.cursorPosition - 1,
        };
      });
    },

    moveCursorLeft: () => {
      update((prev) => ({
        ...prev,
        cursorPosition: Math.max(0, prev.cursorPosition - 1),
      }));
    },

    moveCursorRight: () => {
      update((prev) => ({
        ...prev,
        cursorPosition: Math.min(prev.value.length, prev.cursorPosition + 1),
      }));
    },

    moveCursorStart: () => {
      update((prev) => ({ ...prev, cursorPosition: 0 }));
    },

    moveCursorEnd: () => {
      update((prev) => ({ ...prev, cursorPosition: prev.value.length }));
    },

    submit: () => {
      const prev = get();
      const text = prev.value;
      if (text) {
        set({
          ...prev,
          value: "",
          cursorPosition: 0,
          history: [...prev.history, text],
          historyIndex: null,
        });
      } else {
        set({ ...prev, value: "", cursorPosition: 0, historyIndex: null });
      }
      return text;
    },

    historyPrev: () => {
      update((prev) => {
        if (prev.history.length === 0) {
          return prev;
        }
        const idx =
          prev.historyIndex === null
            ? prev.history.length - 1
            : Math.max(0, prev.historyIndex - 1);
        return {
          ...prev,
          value: prev.history[idx] ?? "",
          cursorPosition: (prev.history[idx] ?? "").length,
          historyIndex: idx,
        };
      });
    },

    historyNext: () => {
      update((prev) => {
        if (prev.history.length === 0) {
          return prev;
        }

        if (prev.historyIndex === null) {
          return prev;
        }

        const idx = prev.historyIndex + 1;
        if (idx >= prev.history.length) {
          return { ...prev, value: "", cursorPosition: 0, historyIndex: null };
        }

        const v = prev.history[idx] ?? "";
        return {
          ...prev,
          value: v,
          cursorPosition: v.length,
          historyIndex: idx,
        };
      });
    },
  };
}

export function handleInputLineKey(
  event: KeyEvent,
  actions: ReturnType<typeof createInputLineActions>,
  onSubmit?: (value: string) => void
): boolean {
  if (event.key === "enter") {
    const v = actions.submit();
    if (v && onSubmit) {
      onSubmit(v);
    }
    return true;
  }

  if (event.key === "backspace") {
    actions.backspace();
    return true;
  }

  if (event.key === "left") {
    actions.moveCursorLeft();
    return true;
  }

  if (event.key === "right") {
    actions.moveCursorRight();
    return true;
  }

  if (event.key === "home") {
    actions.moveCursorStart();
    return true;
  }

  if (event.key === "end") {
    actions.moveCursorEnd();
    return true;
  }

  if (event.key === "up") {
    actions.historyPrev();
    return true;
  }

  if (event.key === "down") {
    actions.historyNext();
    return true;
  }

  if (!(event.ctrl || event.meta || event.alt) && event.key.length === 1) {
    actions.insert(event.key);
    return true;
  }

  return false;
}
