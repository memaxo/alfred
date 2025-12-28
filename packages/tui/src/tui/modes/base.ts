/**
 * ALFRED TUI Base Mode
 *
 * Abstract base class for all interactive TUI modes.
 * Provides lifecycle management, input handling, and rendering patterns.
 */

import { getKeyInput, type KeyEvent } from "../input/keys";
import type { TerminalSize } from "../renderer";
import {
  cleanupTerminal,
  clearScreen,
  getCurrentSize,
  setupTerminal,
  writeAt,
} from "../renderer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModeCallbacks = {
  onExit?: () => void;
  onError?: (error: Error) => void;
};

// ─── Base Mode ───────────────────────────────────────────────────────────────

export abstract class BaseMode {
  protected running = false;
  protected renderInterval: ReturnType<typeof setInterval> | null = null;
  /** Public callbacks for lifecycle hooks */
  readonly callbacks: ModeCallbacks;
  protected size: TerminalSize = { width: 80, height: 24 };

  constructor(callbacks: ModeCallbacks = {}) {
    this.callbacks = callbacks;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Start the mode
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    // Setup terminal
    setupTerminal();

    // Initialize state
    this.init();

    // Get initial size
    this.size = getCurrentSize();

    // Setup input handling
    const keyInput = getKeyInput();
    keyInput.onKey(this.handleKeyInternal);
    keyInput.start();

    // Start render loop at 30 FPS
    this.renderInterval = setInterval(() => {
      this.renderFrame();
    }, 33);

    // Handle resize
    process.stdout.on("resize", this.handleResize);

    // Initial render
    this.renderFrame();
  }

  /**
   * Stop the mode
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;

    // Stop input handling
    const keyInput = getKeyInput();
    keyInput.stop();

    // Stop render loop
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    // Remove resize handler
    process.stdout.off("resize", this.handleResize);

    // Cleanup
    this.cleanup();
    cleanupTerminal();
  }

  /**
   * Exit the mode and call callback
   */
  exit(): void {
    this.stop();
    this.callbacks.onExit?.();
  }

  // ─── Resize Handling ─────────────────────────────────────────────────────────

  private readonly handleResize = (): void => {
    this.size = getCurrentSize();
    this.onResize(this.size);
  };

  // ─── Input Handling ──────────────────────────────────────────────────────────

  private readonly handleKeyInternal = (event: KeyEvent): boolean => {
    // Global exit on Ctrl+C
    if (event.ctrl && event.key === "c") {
      this.exit();
      return true;
    }

    // Delegate to subclass
    return this.handleKey(event);
  };

  // ─── Rendering ───────────────────────────────────────────────────────────────

  private renderFrame(): void {
    if (!this.running) {
      return;
    }

    try {
      const lines = this.render(this.size);
      clearScreen();
      for (let y = 0; y < lines.length; y++) {
        writeAt(0, y, lines[y] ?? "");
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    }
  }

  // ─── Abstract Methods ────────────────────────────────────────────────────────

  /**
   * Initialize mode state - called once on start
   */
  protected abstract init(): void;

  /**
   * Cleanup mode state - called once on stop
   */
  protected abstract cleanup(): void;

  /**
   * Handle key event - return true if handled
   */
  protected abstract handleKey(event: KeyEvent): boolean;

  /**
   * Render the mode - return array of lines to display
   */
  protected abstract render(size: TerminalSize): string[];

  /**
   * Called when terminal is resized
   */
  protected onResize(_size: TerminalSize): void {
    // Override in subclass if needed
  }
}

// ─── Mode Runner ─────────────────────────────────────────────────────────────

/**
 * Run a mode and wait for it to exit
 */
export function runMode(mode: BaseMode): Promise<void> {
  return new Promise((resolve) => {
    const originalOnExit = mode.callbacks.onExit;
    mode.callbacks.onExit = () => {
      originalOnExit?.();
      resolve();
    };
    mode.start();
  });
}
