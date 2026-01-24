/**
 * ALFRED TUI Renderer
 *
 * Wraps OpenTUI's createCliRenderer with ALFRED-specific initialization,
 * resize handling, and lifecycle management.
 */

import type { CliRenderer } from "@opentui/core";

import { createCliRenderer } from "@opentui/core";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TerminalSize = {
  width: number;
  height: number;
};

export type ResizeHandler = (size: TerminalSize) => void;

export type RendererContext = {
  renderer: CliRenderer;
  size: TerminalSize;
  onResize: (handler: ResizeHandler) => () => void;
  destroy: () => void;
};

// ─── State ───────────────────────────────────────────────────────────────────

let currentRenderer: RendererContext | null = null;
const resizeHandlers = new Set<ResizeHandler>();
let terminalSetup = false;

// ─── Terminal Size Detection ─────────────────────────────────────────────────

function getTerminalSize(): TerminalSize {
  return {
    width:
      process.stdout.columns ||
      Number.parseInt(process.env.COLUMNS || "80", 10),
    height:
      process.stdout.rows || Number.parseInt(process.env.LINES || "24", 10),
  };
}

// ─── Resize Handling ─────────────────────────────────────────────────────────

function setupResizeListener(): () => void {
  const handleResize = () => {
    const size = getTerminalSize();
    for (const handler of resizeHandlers) {
      try {
        handler(size);
      } catch {
        // Ignore handler errors
      }
    }
  };

  if (process.stdout.isTTY) {
    process.stdout.on("resize", handleResize);
  }

  return () => {
    if (process.stdout.isTTY) {
      process.stdout.off("resize", handleResize);
    }
  };
}

// ─── Renderer Initialization ─────────────────────────────────────────────────

export async function initRenderer(): Promise<RendererContext> {
  if (currentRenderer) {
    return currentRenderer;
  }

  const renderer = await createCliRenderer();
  const size = getTerminalSize();
  const cleanupResize = setupResizeListener();

  const context: RendererContext = {
    renderer,
    size,
    onResize: (handler: ResizeHandler) => {
      resizeHandlers.add(handler);
      // Immediately call with current size
      handler(size);
      return () => {
        resizeHandlers.delete(handler);
      };
    },
    destroy: () => {
      cleanupResize();
      resizeHandlers.clear();
      currentRenderer = null;
    },
  };

  currentRenderer = context;
  return context;
}

// ─── Convenience Accessors ───────────────────────────────────────────────────

export function getRenderer(): RendererContext | null {
  return currentRenderer;
}

export function getCurrentSize(): TerminalSize {
  return currentRenderer?.size ?? getTerminalSize();
}

// ─── Raw Terminal Operations ─────────────────────────────────────────────────

/**
 * Clear the terminal screen
 */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Move cursor to position
 */
export function moveCursor(x: number, y: number): void {
  process.stdout.write(`\x1b[${y + 1};${x + 1}H`);
}

/**
 * Hide cursor
 */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

/**
 * Show cursor
 */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

/**
 * Enable alternate screen buffer (preserves main terminal content)
 */
export function enterAlternateScreen(): void {
  process.stdout.write("\x1b[?1049h");
}

/**
 * Disable alternate screen buffer (restores main terminal content)
 */
export function exitAlternateScreen(): void {
  process.stdout.write("\x1b[?1049l");
}

/**
 * Write text at current cursor position
 */
export function write(text: string): void {
  process.stdout.write(text);
}

/**
 * Write text at specific position
 */
export function writeAt(x: number, y: number, text: string): void {
  moveCursor(x, y);
  write(text);
}

// ─── Lifecycle Helpers ───────────────────────────────────────────────────────

/**
 * Setup terminal for TUI mode
 */
export function setupTerminal(): void {
  if (terminalSetup) {
    return;
  }

  // Skip setup in non-TTY environments (e.g. tests)
  if (!process.stdout.isTTY) {
    return;
  }

  terminalSetup = true;

  enterAlternateScreen();
  hideCursor();
  clearScreen();

  // Handle Ctrl+C gracefully
  process.on("SIGINT", handleSigInt);

  // Handle terminal resize
  process.on("SIGWINCH", handleSigWinch);
}

function handleSigInt(): void {
  cleanupTerminal();
  process.exit(0);
}

function handleSigWinch(): void {
  if (currentRenderer) {
    currentRenderer.size = getTerminalSize();
  }
}

/**
 * Cleanup terminal on exit
 */
export function cleanupTerminal(): void {
  if (!terminalSetup) {
    return;
  }
  terminalSetup = false;

  showCursor();
  exitAlternateScreen();
  currentRenderer?.destroy();

  process.off("SIGINT", handleSigInt);
  process.off("SIGWINCH", handleSigWinch);
}

// ─── Frame Rendering ─────────────────────────────────────────────────────────

export type RenderFn = (size: TerminalSize) => string[];

/**
 * Render a frame to the terminal
 */
export function renderFrame(lines: string[]): void {
  // Move cursor to home instead of clearing the whole screen to reduce flickering
  moveCursor(0, 0);
  for (let y = 0; y < lines.length; y++) {
    writeAt(0, y, lines[y] ?? "");
  }
}

/**
 * Create a simple render loop
 */
export function createRenderLoop(
  renderFn: RenderFn,
  fps = 30
): { start: () => void; stop: () => void } {
  let running = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const render = () => {
    const size = getCurrentSize();
    const lines = renderFn(size);
    renderFrame(lines);
  };

  return {
    start: () => {
      if (running) {
        return;
      }
      running = true;
      render(); // Initial render
      intervalId = setInterval(render, 1000 / fps);
      intervalId.unref?.();
    },
    stop: () => {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
