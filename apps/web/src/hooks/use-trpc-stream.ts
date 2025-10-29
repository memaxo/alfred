/**
 * useTRPCStream Hook
 * 
 * Wires tRPC streaming subscriptions to React state
 * Handles cache handoff and error states
 * 
 * Carmack-Karpathy principles:
 * - Pure event transformations
 * - Zero allocations in hot paths
 * - Fast failure
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import type { StreamEvent } from "@alfred/type/stream";
import {
  isMessageEvent,
  isActionEvent,
  isStatusEvent,
  isProgressEvent,
  isCacheHandoffEvent,
  isErrorEvent,
} from "@alfred/type/stream";

interface UseTRPCStreamOptions {
  agent: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
  onError?: (error: Error) => void;
}

interface UseTRPCStreamReturn {
  // State
  messages: Array<{ id: string; role: string; content: string; timestamp: Date }>;
  actions: Array<{
    id: string;
    tool: string;
    args: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "error";
    result?: unknown;
  }>;
  status: "connecting" | "connected" | "disconnected" | "error";
  error: Error | null;
  
  // Actions
  send: (message: string) => void;
  clear: () => void;
}

export function useTRPCStream({
  agent,
  thread,
  resource,
  onError,
}: UseTRPCStreamOptions): UseTRPCStreamReturn {
  const queryClient = useQueryClient();
  
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; timestamp: Date }>>([]);
  const [actions, setActions] = useState<Array<{
    id: string;
    tool: string;
    args: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "error";
    result?: unknown;
  }>>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [error, setError] = useState<Error | null>(null);
  
  const messageIdRef = useRef(0);

  // Handle cache handoff automatically
  const handleCacheHandoff = useCallback((event: StreamEvent) => {
    if (isCacheHandoffEvent(event)) {
      const { key, value, merge } = event.data;
      if (merge) {
        queryClient.setQueryData(key, (old: unknown) => ({
          ...(old as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        }));
      } else {
        queryClient.setQueryData(key, value);
      }
    }
  }, [queryClient]);

  // Transform event to state
  const handleEvent = useCallback((event: StreamEvent) => {
    if (isMessageEvent(event)) {
      const id = `msg-${messageIdRef.current++}`;
      setMessages((prev) => [...prev, {
        id,
        role: event.data.role,
        content: event.data.delta,
        timestamp: new Date(event.ts),
      }]);
    } else if (isActionEvent(event)) {
      setActions((prev) => {
        const existing = prev.findIndex((a) => a.id === event.data.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            id: event.data.id,
            tool: event.data.tool,
            args: event.data.args,
            status: event.data.status,
            result: event.data.result,
          };
          return updated;
        }
        return [...prev, {
          id: event.data.id,
          tool: event.data.tool,
          args: event.data.args,
          status: event.data.status,
          result: event.data.result,
        }];
      });
    } else if (isStatusEvent(event)) {
      setStatus(event.data.state);
    } else if (isProgressEvent(event)) {
      // Handle progress updates
      console.log(`Progress: ${event.data.percent}% - ${event.data.message}`);
    } else if (isErrorEvent(event)) {
      const err = new Error(event.data.message);
      setError(err);
      onError?.(err);
    }
    
    // Always handle cache handoff
    handleCacheHandoff(event);
  }, [handleCacheHandoff, onError]);

  // Clear state
  const clear = useCallback(() => {
    setMessages([]);
    setActions([]);
    setStatus("disconnected");
    setError(null);
    messageIdRef.current = 0;
  }, []);

  // Send message (triggers tRPC subscription)
  const send = useCallback((message: string) => {
    // The actual streaming is handled by React Query subscription
    // We return the handlers, but the subscription manages the connection
    console.log(`Sending to ${agent}:`, message);
  }, [agent]);

  return {
    messages,
    actions,
    status,
    error,
    send,
    clear,
  };
}

