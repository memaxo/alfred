/**
 * ALFRED TUI Keyboard Input Handler
 *
 * Low-level keyboard event handling for the TUI.
 * Translates raw terminal input into structured key events.
 */

import { EventEmitter } from "node:events";

// ─── Types ───────────────────────────────────────────────────────────────────

export type KeyEvent = {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  raw: string;
};

export type KeyHandler = (event: KeyEvent) => undefined | boolean;

// ─── Special Key Codes ───────────────────────────────────────────────────────

const SPECIAL_KEYS: Record<string, string> = {
  "\r": "enter",
  "\n": "enter",
  "\t": "tab",
  "\x7f": "backspace",
  "\x1b": "escape",
  " ": "space",

  // Arrow keys
  "\x1b[A": "up",
  "\x1b[B": "down",
  "\x1b[C": "right",
  "\x1b[D": "left",

  // Arrow keys (alternate)
  "\x1bOA": "up",
  "\x1bOB": "down",
  "\x1bOC": "right",
  "\x1bOD": "left",

  // Navigation
  "\x1b[H": "home",
  "\x1b[F": "end",
  "\x1b[5~": "pageup",
  "\x1b[6~": "pagedown",
  "\x1b[2~": "insert",
  "\x1b[3~": "delete",

  // Function keys
  "\x1bOP": "f1",
  "\x1bOQ": "f2",
  "\x1bOR": "f3",
  "\x1bOS": "f4",
  "\x1b[15~": "f5",
  "\x1b[17~": "f6",
  "\x1b[18~": "f7",
  "\x1b[19~": "f8",
  "\x1b[20~": "f9",
  "\x1b[21~": "f10",
  "\x1b[23~": "f11",
  "\x1b[24~": "f12",
};

// ─── Key Parsing ─────────────────────────────────────────────────────────────

export function parseKeyEvent(raw: string): KeyEvent {
  let key = raw;
  let ctrl = false;
  let alt = false;
  let shift = false;
  const meta = false;

  // Check for special keys
  if (SPECIAL_KEYS[raw]) {
    key = SPECIAL_KEYS[raw] ?? raw;
  }
  // Check for Shift+Tab
  else if (raw === "\x1b[Z") {
    key = "tab";
    shift = true;
  }
  // Check for Ctrl+key (ASCII 1-26)
  else if (raw.length === 1) {
    const code = raw.charCodeAt(0);
    if (code >= 1 && code <= 26) {
      ctrl = true;
      key = String.fromCharCode(code + 96); // Convert to lowercase letter
    }
  }
  // Check for Alt+key
  else if (raw.startsWith("\x1b") && raw.length === 2) {
    alt = true;
    key = raw[1] ?? "";
  }
  // Check for Shift+Arrow and other modified keys
  else if (raw.startsWith("\x1b[1;")) {
    const modifier = raw[4];
    const keyCode = raw.slice(5);

    if (modifier === "2") {
      shift = true;
    } else if (modifier === "3") {
      alt = true;
    } else if (modifier === "5") {
      ctrl = true;
    }

    if (keyCode === "A") {
      key = "up";
    } else if (keyCode === "B") {
      key = "down";
    } else if (keyCode === "C") {
      key = "right";
    } else if (keyCode === "D") {
      key = "left";
    }
  }

  return { key, ctrl, alt, shift, meta, raw };
}

// ─── Key Input Manager ───────────────────────────────────────────────────────

export class KeyInput extends EventEmitter {
  private readonly handlers: KeyHandler[] = [];
  private listening = false;

  /**
   * Start listening for keyboard input
   */
  start(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", this.handleData);
  }

  /**
   * Stop listening for keyboard input
   */
  stop(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;

    process.stdin.off("data", this.handleData);
    process.stdin.setRawMode?.(false);
    process.stdin.pause();
  }

  /**
   * Add a key handler
   */
  onKey(handler: KeyHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private readonly handleData = (data: string): void => {
    const event = parseKeyEvent(data);
    this.emit("key", event);

    // Call handlers in reverse order (last registered first)
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      const handler = this.handlers[i];
      if (handler) {
        const handled = handler(event);
        if (handled === true) {
          break; // Stop propagation
        }
      }
    }
  };
}

// ─── Key Binding Helpers ─────────────────────────────────────────────────────

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description?: string;
};

export function matchesBinding(event: KeyEvent, binding: KeyBinding): boolean {
  if (event.key !== binding.key) {
    return false;
  }
  if (binding.ctrl && !event.ctrl) {
    return false;
  }
  if (binding.alt && !event.alt) {
    return false;
  }
  if (binding.shift && !event.shift) {
    return false;
  }
  return true;
}

export function createKeyBindingHandler(bindings: KeyBinding[]): KeyHandler {
  return (event: KeyEvent) => {
    for (const binding of bindings) {
      if (matchesBinding(event, binding)) {
        binding.action();
        return true;
      }
    }
    return false;
  };
}

// ─── Convenience Helpers ─────────────────────────────────────────────────────

export function isQuit(event: KeyEvent): boolean {
  return event.key === "q" || (event.ctrl && event.key === "c");
}

export function isEscape(event: KeyEvent): boolean {
  return event.key === "escape";
}

export function isEnter(event: KeyEvent): boolean {
  return event.key === "enter";
}

export function isTab(event: KeyEvent): boolean {
  return event.key === "tab" && !event.shift;
}

export function isShiftTab(event: KeyEvent): boolean {
  return event.key === "tab" && event.shift;
}

export function isArrowUp(event: KeyEvent): boolean {
  return event.key === "up";
}

export function isArrowDown(event: KeyEvent): boolean {
  return event.key === "down";
}

export function isArrowLeft(event: KeyEvent): boolean {
  return event.key === "left";
}

export function isArrowRight(event: KeyEvent): boolean {
  return event.key === "right";
}

export function isNumber(event: KeyEvent): boolean {
  return /^[0-9]$/.test(event.key);
}

export function getNumber(event: KeyEvent): number | null {
  if (isNumber(event)) {
    return Number.parseInt(event.key, 10);
  }
  return null;
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let globalKeyInput: KeyInput | null = null;

export function getKeyInput(): KeyInput {
  if (!globalKeyInput) {
    globalKeyInput = new KeyInput();
  }
  return globalKeyInput;
}
