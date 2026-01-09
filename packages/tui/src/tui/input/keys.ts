export type KeyEvent = {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  raw?: string;
};

export type KeyInput = {
  onKey: (handler: (event: KeyEvent) => void) => () => void;
  start: () => void;
  stop: () => void;
};

export function isEscape(event: KeyEvent): boolean {
  return event.key === "escape";
}

export function getKeyInput(): KeyInput {
  const listeners = new Set<(event: KeyEvent) => void>();
  return {
    onKey: (handler) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    start: () => {},
    stop: () => {
      listeners.clear();
    },
  };
}
