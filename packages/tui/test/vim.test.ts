import { describe, expect, test } from "bun:test";

import { createVimMotionState, handleVimMotion } from "../src/tui/react/vim";

describe("vim motion helper", () => {
  const key = (name: string, opts: Record<string, unknown> = {}) =>
    ({ name, ...opts }) as any;

  test("gg jumps to top", () => {
    const state = createVimMotionState();
    expect(handleVimMotion(key("g"), state)).toBe("none");
    expect(state.pendingG).toBe(true);
    expect(handleVimMotion(key("g"), state)).toBe("top");
    expect(state.pendingG).toBe(false);
  });

  test("G jumps to bottom", () => {
    const state = createVimMotionState();
    expect(handleVimMotion(key("G"), state)).toBe("bottom");
    expect(state.pendingG).toBe(false);
  });

  test("ctrl/alt cancels pending", () => {
    const state = createVimMotionState();
    handleVimMotion(key("g"), state);
    expect(state.pendingG).toBe(true);
    expect(handleVimMotion(key("x", { ctrl: true }), state)).toBe("none");
    expect(state.pendingG).toBe(false);
    expect(handleVimMotion(key("g"), state)).toBe("none");
    expect(handleVimMotion(key("g", { alt: true }), state)).toBe("none");
  });
});
