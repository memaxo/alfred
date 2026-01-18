export const defaults = {
  /**
   * Default debounce for input-driven state changes in UI.
   */
  uiInputDebounceMs: 250,

  /**
   * Default throttle for high-frequency UI events (scroll, pointer move).
   */
  uiEventThrottleMs: 50,
} as const;
