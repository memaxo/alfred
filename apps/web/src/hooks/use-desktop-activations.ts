import { useEffect } from "react";

export type DesktopActivationEventType =
  | "voice-input"
  | "voice-output"
  | "tool-call"
  | "rag-retrieval"
  | "workflow-step"
  | "context-cache";

export type DesktopActivationEvent = {
  type: DesktopActivationEventType;
  sourceId?: string;
  targetId?: string;
  data?: unknown;
};

// Global event bus for non-React contexts
const desktopEventBus = new EventTarget();

export function dispatchDesktopEvent(event: DesktopActivationEvent) {
  const customEvent = new CustomEvent("desktop-activation", {
    detail: event,
  });
  desktopEventBus.dispatchEvent(customEvent);
}

/**
 * Hook for desktop activation events.
 * @deprecated Edge activity functionality removed in new type system
 */
export function useDesktopActivations() {
  useEffect(() => {
    // No-op: edge activity removed in new type system
    const handleEvent = (_e: Event) => {
      // Events are still dispatched for logging/debugging but no visual effect
    };
    desktopEventBus.addEventListener("desktop-activation", handleEvent);
    return () => {
      desktopEventBus.removeEventListener("desktop-activation", handleEvent);
    };
  }, []);

  return {
    dispatch: dispatchDesktopEvent,
  };
}
