import { describe, expect, mock, test } from "bun:test";
import {
  createMessageHistoryActions,
  createMessageHistoryState,
} from "../../src/tui/components/history";
import {
  createInputLineActions,
  createInputLineState,
  handleInputLineKey,
} from "../../src/tui/components/input";
import type { KeyEvent } from "../../src/tui/input/keys";

// Mock renderer module
mock.module("../../src/tui/renderer", () => ({
  setupTerminal: mock(() => {}),
  cleanupTerminal: mock(() => {}),
  clearScreen: mock(() => {}),
  writeAt: mock(() => {}),
  getCurrentSize: mock(() => ({ width: 80, height: 24 })),
}));

// Mock keys module
mock.module("../../src/tui/input/keys", () => ({
  getKeyInput: mock(() => ({
    onKey: mock(() => () => {}),
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  isEscape: (e: KeyEvent) => e.key === "escape",
}));

describe("Chat Mode Components", () => {
  describe("InputLine", () => {
    test("creates initial state", () => {
      const state = createInputLineState("placeholder");
      expect(state.value).toBe("");
      expect(state.cursorPosition).toBe(0);
      expect(state.placeholder).toBe("placeholder");
      expect(state.history).toEqual([]);
    });

    test("inserts characters", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("h");
      expect(state.value).toBe("h");
      expect(state.cursorPosition).toBe(1);

      actions.insert("i");
      expect(state.value).toBe("hi");
      expect(state.cursorPosition).toBe(2);
    });

    test("handles backspace", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("test");
      actions.backspace();
      expect(state.value).toBe("tes");
      expect(state.cursorPosition).toBe(3);
    });

    test("handles cursor movement", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("hello");
      actions.moveCursorLeft();
      expect(state.cursorPosition).toBe(4);

      actions.moveCursorStart();
      expect(state.cursorPosition).toBe(0);

      actions.moveCursorEnd();
      expect(state.cursorPosition).toBe(5);
    });

    test("submit clears input and adds to history", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("test message");
      const submitted = actions.submit();

      expect(submitted).toBe("test message");
      expect(state.value).toBe("");
      expect(state.history).toContain("test message");
    });

    test("history navigation", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("first");
      actions.submit();
      actions.insert("second");
      actions.submit();

      actions.historyPrev();
      expect(state.value).toBe("second");

      actions.historyPrev();
      expect(state.value).toBe("first");

      actions.historyNext();
      expect(state.value).toBe("second");
    });
  });

  describe("MessageHistory", () => {
    test("creates initial state", () => {
      const state = createMessageHistoryState();
      expect(state.messages).toEqual([]);
      expect(state.scrollOffset).toBe(0);
      expect(state.autoScroll).toBe(true);
    });

    test("adds messages", () => {
      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const id = actions.addMessage({ role: "user", content: "Hello" });
      expect(state.messages.length).toBe(1);
      expect(state.messages[0]?.content).toBe("Hello");
      expect(state.messages[0]?.role).toBe("user");
      expect(id).toBeDefined();
    });

    test("updates messages", () => {
      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const id = actions.addMessage({
        role: "assistant",
        content: "Hello",
        status: "streaming",
      });
      actions.updateMessage(id, { status: "complete" });

      expect(state.messages[0]?.status).toBe("complete");
    });

    test("appends to messages", () => {
      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const id = actions.addMessage({ role: "assistant", content: "Hello" });
      actions.appendToMessage(id, " World");

      expect(state.messages[0]?.content).toBe("Hello World");
    });

    test("scroll behavior", () => {
      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.scrollUp(5);
      expect(state.scrollOffset).toBe(5);
      expect(state.autoScroll).toBe(false);

      actions.scrollDown(3);
      expect(state.scrollOffset).toBe(2);

      actions.scrollToBottom();
      expect(state.scrollOffset).toBe(0);
      expect(state.autoScroll).toBe(true);
    });
  });

  describe("Key Handling", () => {
    test("handles Enter key for submit", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("test");
      let submitted = "";
      const event: KeyEvent = {
        key: "enter",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        raw: "\r",
      };

      const handled = handleInputLineKey(event, actions, (v) => {
        submitted = v;
      });

      expect(handled).toBe(true);
      expect(submitted).toBe("test");
    });

    test("handles arrow keys", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.insert("test");

      const leftEvent: KeyEvent = {
        key: "left",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        raw: "",
      };
      handleInputLineKey(leftEvent, actions);
      expect(state.cursorPosition).toBe(3);

      const rightEvent: KeyEvent = {
        key: "right",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        raw: "",
      };
      handleInputLineKey(rightEvent, actions);
      expect(state.cursorPosition).toBe(4);
    });

    test("handles character input", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const event: KeyEvent = {
        key: "a",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        raw: "a",
      };
      const handled = handleInputLineKey(event, actions);

      expect(handled).toBe(true);
      expect(state.value).toBe("a");
    });

    test("ignores ctrl+key combinations", () => {
      let state = createInputLineState();
      const actions = createInputLineActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const event: KeyEvent = {
        key: "a",
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
        raw: "",
      };
      // Ctrl+A is handled (move to start)
      handleInputLineKey(event, actions);
      // Value should still be empty since ctrl+a moves cursor, doesn't insert
      expect(state.value).toBe("");
    });
  });
});
