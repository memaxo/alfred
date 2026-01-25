/**
 * React hooks for subscription management.
 */

import type { SubscriptionEvent, SubscriptionState } from "@alfred/type";

import { useCallback, useEffect, useRef, useState } from "react";

import { subscriptionManager } from "./manager";

interface UseSubscriptionOptions {
  cursor?: string;
  enabled?: boolean;
}

interface UseSubscriptionResult<T> {
  status: SubscriptionState["status"];
  cursor: string | null;
  lastEvent: SubscriptionEvent<T> | null;
}

/**
 * Subscribe to a real-time stream with cursor-based resume.
 */
export function useSubscription<T>(
  streamId: string,
  onEvent: (event: SubscriptionEvent<T>) => void,
  options: UseSubscriptionOptions = {}
): UseSubscriptionResult<T> {
  const { cursor, enabled = true } = options;
  const [status, setStatus] = useState<SubscriptionState["status"]>(
    enabled ? "connecting" : "disconnected"
  );
  const [currentCursor, setCurrentCursor] = useState<string | null>(
    cursor ?? null
  );
  const [lastEvent, setLastEvent] = useState<SubscriptionEvent<T> | null>(null);

  // Stable callback ref
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handleEvent = useCallback((event: SubscriptionEvent<T>) => {
    setLastEvent(event);
    setCurrentCursor(event.cursor);
    onEventRef.current(event);
  }, []);

  const handleStatus = useCallback((newStatus: SubscriptionState["status"]) => {
    setStatus(newStatus);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    const unsubscribe = subscriptionManager.subscribe(streamId, handleEvent, {
      cursor: currentCursor ?? undefined,
      onStatus: handleStatus,
    });

    return () => {
      unsubscribe();
    };
  }, [streamId, enabled, handleEvent, handleStatus, currentCursor]);

  return { status, cursor: currentCursor, lastEvent };
}

/**
 * Subscribe to graph edge changes.
 */
export function useGraphSubscription(
  nodeIds: string[],
  onEdgeChange: (event: SubscriptionEvent<unknown>) => void,
  options: UseSubscriptionOptions = {}
) {
  const streamId = `graph:${nodeIds.sort().join(",")}`;
  return useSubscription(streamId, onEdgeChange, options);
}

/**
 * Subscribe to workflow run events.
 */
export function useWorkflowSubscription(
  runId: string,
  onEvent: (event: SubscriptionEvent<unknown>) => void,
  options: UseSubscriptionOptions = {}
) {
  const streamId = `workflow:${runId}`;
  return useSubscription(streamId, onEvent, options);
}
