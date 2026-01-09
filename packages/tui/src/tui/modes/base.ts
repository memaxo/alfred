import { getKeyInput, type KeyEvent } from "../input/keys";
import type { TerminalSize } from "../renderer";
import { cleanupTerminal, getCurrentSize, setupTerminal } from "../renderer";

export type BaseModeOptions = {
  onExit?: () => void;
};

export abstract class BaseMode {
  private started = false;
  private stopped = false;
  private readonly exitListeners: Array<() => void> = [];
  private unsubscribeKey: (() => void) | null = null;
  private readonly keyInput = getKeyInput();

  constructor(options: BaseModeOptions = {}) {
    if (options.onExit) {
      this.exitListeners.push(options.onExit);
    }
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    setupTerminal();
    this.init();

    this.unsubscribeKey = this.keyInput.onKey((event) => {
      if (this.handleKey(event)) {
        return;
      }
    });
    this.keyInput.start();

    try {
      this.onResize(getCurrentSize());
    } catch {
      // ignore
    }
  }

  stop(): void {
    if (!this.started || this.stopped) {
      return;
    }
    this.stopped = true;

    try {
      this.unsubscribeKey?.();
    } finally {
      this.unsubscribeKey = null;
      this.keyInput.stop();
    }

    try {
      this.cleanup();
    } finally {
      cleanupTerminal();
    }
  }

  exit(): void {
    for (const cb of this.exitListeners) {
      try {
        cb();
      } catch {
        // ignore
      }
    }
  }

  onExit(cb: () => void): void {
    this.exitListeners.push(cb);
  }

  protected abstract init(): void;
  protected abstract cleanup(): void;
  protected abstract handleKey(event: KeyEvent): boolean;
  protected abstract render(size: TerminalSize): string[];
  protected onResize(_size: TerminalSize): void {}
}

export function runMode(mode: BaseMode): Promise<void> {
  return new Promise((resolve) => {
    mode.onExit(() => resolve());
    mode.start();
  });
}
