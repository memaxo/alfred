import { useCallback, useEffect } from "react";
import { useMindscapeStore } from "@/store/mindscape";

type MindscapeEventType =
  | "voice-input"
  | "voice-output"
  | "tool-call"
  | "rag-retrieval"
  | "workflow-step"
  | "context-cache";

type MindscapeEvent = {
  type: MindscapeEventType;
  sourceId?: string; // e.g. "user", "chat"
  targetId?: string; // e.g. "voice-session", "tool-linear", "knowledge-123"
  data?: unknown;
};

// Global event bus for non-React contexts (optional, but good for decoupled triggers)
const mindscapeEventBus = new EventTarget();

export function dispatchMindscapeEvent(event: MindscapeEvent) {
  const customEvent = new CustomEvent("mindscape-activation", {
    detail: event,
  });
  mindscapeEventBus.dispatchEvent(customEvent);
}

export function useMindscapeActivations() {
  const triggerNodeActivity = useMindscapeStore(
    (state) => state.triggerNodeActivity
  );
  const triggerEdgeActivity = useMindscapeStore(
    (state) => state.triggerEdgeActivity
  );
  const edges = useMindscapeStore((state) => state.edges);

  const handleEvent = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<MindscapeEvent>).detail;

      // Strategy:
      // 1. If sourceId and targetId are known, pulse the specific edge
      // 2. If only sourceId is known, pulse all outgoing edges (triggerNodeActivity)

      if (detail.sourceId && detail.targetId) {
        const edge = edges.find(
          (edge) =>
            (edge.source === detail.sourceId &&
              edge.target === detail.targetId) ||
            (edge.source === detail.targetId && edge.target === detail.sourceId)
        );

        if (edge) {
          triggerEdgeActivity(edge.id, 1000);
        } else {
          // Fallback: Pulse both nodes if no direct edge found (they might be indirectly connected)
          triggerNodeActivity(detail.sourceId, "output");
          triggerNodeActivity(detail.targetId, "input");
        }
      } else if (detail.sourceId) {
        triggerNodeActivity(detail.sourceId, "output");
      } else if (detail.targetId) {
        triggerNodeActivity(detail.targetId, "input");
      }
    },
    [edges, triggerEdgeActivity, triggerNodeActivity]
  );

  useEffect(() => {
    mindscapeEventBus.addEventListener("mindscape-activation", handleEvent);
    return () => {
      mindscapeEventBus.removeEventListener(
        "mindscape-activation",
        handleEvent
      );
    };
  }, [handleEvent]);

  return {
    dispatch: dispatchMindscapeEvent,
  };
}
