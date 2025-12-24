import { useCallback, useEffect } from "react";
import { useDesktopStore } from "@/store/desktop";

export type DesktopActivationEventType =
  | "voice-input"
  | "voice-output"
  | "tool-call"
  | "rag-retrieval"
  | "workflow-step"
  | "context-cache";

export type DesktopActivationEvent = {
  type: DesktopActivationEventType;
  sourceId?: string; // e.g. "user", "chat"
  targetId?: string; // e.g. "voice-session", "tool-linear", "knowledge-123"
  data?: unknown;
};

// Global event bus for non-React contexts (good for decoupled triggers)
const desktopEventBus = new EventTarget();

export function dispatchDesktopEvent(event: DesktopActivationEvent) {
  const customEvent = new CustomEvent("desktop-activation", {
    detail: event,
  });
  desktopEventBus.dispatchEvent(customEvent);
}

export function useDesktopActivations() {
  const triggerEdgeActivity = useDesktopStore(
    (state) => state.triggerEdgeActivity
  );
  const edges = useDesktopStore((state) => state.edges);

  const handleEvent = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<DesktopActivationEvent>).detail;

      // Strategy:
      // 1. If sourceId and targetId are known, pulse the specific edge
      // 2. If only sourceId is known, pulse edges from that source

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
          // Fallback: Pulse all edges from source or target
          const connectedEdges = edges.filter(
            (e) =>
              e.source === detail.sourceId ||
              e.target === detail.sourceId ||
              e.source === detail.targetId ||
              e.target === detail.targetId
          );
          connectedEdges.forEach((edge) => {
            triggerEdgeActivity(edge.id, 800);
          });
        }
      } else if (detail.sourceId) {
        const connectedEdges = edges.filter(
          (e) => e.source === detail.sourceId || e.target === detail.sourceId
        );
        connectedEdges.forEach((edge) => {
          triggerEdgeActivity(edge.id, 1000);
        });
      } else if (detail.targetId) {
        const connectedEdges = edges.filter(
          (e) => e.source === detail.targetId || e.target === detail.targetId
        );
        connectedEdges.forEach((edge) => {
          triggerEdgeActivity(edge.id, 1000);
        });
      }
    },
    [edges, triggerEdgeActivity]
  );

  useEffect(() => {
    desktopEventBus.addEventListener("desktop-activation", handleEvent);
    return () => {
      desktopEventBus.removeEventListener("desktop-activation", handleEvent);
    };
  }, [handleEvent]);

  return {
    dispatch: dispatchDesktopEvent,
  };
}
