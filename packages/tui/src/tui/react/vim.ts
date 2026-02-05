import type { KeyEvent } from "@opentui/core";

export interface VimMotionState {
  pendingG: boolean;
}

export type VimMotion = "none" | "top" | "bottom";

export function createVimMotionState(): VimMotionState {
  return { pendingG: false };
}

export function handleVimMotion(
  event: KeyEvent,
  state: VimMotionState
): VimMotion {
  const ctrl = (event as { ctrl?: boolean }).ctrl ?? false;
  const alt = (event as { alt?: boolean }).alt ?? false;
  const shift = (event as { shift?: boolean }).shift ?? false;

  if (ctrl || alt) {
    state.pendingG = false;
    return "none";
  }

  if (event.name === "G" || (event.name === "g" && shift)) {
    state.pendingG = false;
    return "bottom";
  }

  if (event.name === "g") {
    if (state.pendingG) {
      state.pendingG = false;
      return "top";
    }
    state.pendingG = true;
    return "none";
  }

  state.pendingG = false;
  return "none";
}
