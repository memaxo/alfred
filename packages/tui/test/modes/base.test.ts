import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { KeyEvent } from "../../src/tui/input/keys";
import { BaseMode, runMode } from "../../src/tui/modes/base";
import type { TerminalSize } from "../../src/tui/renderer";

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
}));

/**
 * Test implementation of BaseMode
 */
class TestMode extends BaseMode {
  public initCalled = false;
  public cleanupCalled = false;
  public keysHandled: KeyEvent[] = [];
  public renderCount = 0;
  public resizes: TerminalSize[] = [];

  protected init(): void {
    this.initCalled = true;
  }

  protected cleanup(): void {
    this.cleanupCalled = true;
  }

  protected handleKey(event: KeyEvent): boolean {
    this.keysHandled.push(event);
    if (event.key === "escape") {
      this.exit();
      return true;
    }
    return false;
  }

  protected render(_size: TerminalSize): string[] {
    this.renderCount++;
    return ["Test Mode", "Line 2"];
  }

  protected onResize(size: TerminalSize): void {
    this.resizes.push(size);
  }
}

describe("BaseMode", () => {
  let mode: TestMode;

  beforeEach(() => {
    mode = new TestMode();
  });

  afterEach(() => {
    try {
      mode.stop();
    } catch {
      // ignore
    }
  });

  test("init is called on start", () => {
    expect(mode.initCalled).toBe(false);
    mode.start();
    expect(mode.initCalled).toBe(true);
  });

  test("cleanup is called on stop", () => {
    mode.start();
    expect(mode.cleanupCalled).toBe(false);
    mode.stop();
    expect(mode.cleanupCalled).toBe(true);
  });

  test("does not init twice", () => {
    mode.start();
    mode.initCalled = false;
    mode.start();
    expect(mode.initCalled).toBe(false);
  });

  test("exit calls onExit callback", () => {
    let exited = false;
    const modeWithCallback = new TestMode({
      onExit: () => {
        exited = true;
      },
    });
    modeWithCallback.start();
    modeWithCallback.exit();
    expect(exited).toBe(true);
  });

  test("render returns string array", () => {
    const lines = mode.render({ width: 80, height: 24 });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.every((l) => typeof l === "string")).toBe(true);
  });
});

describe("runMode", () => {
  test("resolves when mode exits", async () => {
    const mode = new TestMode();

    // Start mode and exit after a small delay
    const promise = runMode(mode);
    setTimeout(() => mode.exit(), 10);

    await expect(promise).resolves.toBeUndefined();
  });
});
