/**
 * useAssistantStream Hook
 * 
 * Composable hook for assistant streaming via tRPC
 * Transforms tRPC observable to React state
 * 
 * Carmack-Karpathy principles:
 * - Single responsibility: assistant streaming only
 * - Pure transformations: observable → state
 * - Zero allocations: stable state updates
 */

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

interface UseAssistantStreamOptions {
  thread?: string;
  resource?: string;
  onError?: (error: Error) => void;
}

interface UseAssistantStreamReturn {
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

export function useAssistantStream({
  thread,
  resource,
  onError,
}: UseAssistantStreamOptions = {}): UseAssistantStreamReturn {
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
  const currentInputRef = useRef<string | null>(null);

  // Handle streaming chunk
  const handleChunk = useCallback((chunk: Record<string, unknown>) => {
    const chunkType = chunk.type as string;
    
    // Status updates
    if (chunkType === "run") {
      setStatus("connected");
    }
    
    // Message deltas
    if (chunkType === "message-delta" || chunkType === "text-delta") {
      const content = (chunk.delta as string) ?? "";
      if (content) {
        const id = `msg-${messageIdRef.current++}`;
        setMessages((prev) => [...prev, {
          id,
          role: "assistant",
          content,
          timestamp: new Date(),
        }]);
      }
    }
    
    // Tool calls
    if (chunkType === "tool-call" || chunkType === "tool-result") {
      const toolCall = chunk.toolCall as Record<string, unknown>;
      if (toolCall) {
        setActions((prev) => {
          const existing = prev.findIndex((a) => a.id === toolCall.toolCallId as string);
          const action = {
            id: toolCall.toolCallId as string,
            tool: toolCall.toolName as string,
            args: (toolCall.args as Record<string, unknown>) ?? {},
            status: (chunkType === "tool-result" ? "completed" : "running") as "pending" | "running" | "completed" | "error",
            result: chunk.result as unknown,
          };
          
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = action;
            return updated;
          }
          return [...prev, action];
        });
      }
    }
    
    // Cache handoff
    if (chunkType === "data-cache-handoff") {
      const key = chunk.key as string[];
      const value = chunk.value;
      if (key && value) {
        queryClient.setQueryData(key, value);
      }
    }
    
    // Error handling
    if (chunkType === "error") {
      const err = new Error(chunk.message as string ?? "Unknown error");
      setError(err);
      setStatus("error");
      onError?.(err);
    }
  }, [queryClient, onError]);

  // Send message
  const send = useCallback((message: string) => {
    if (!message.trim()) return;
    
    currentInputRef.current = message;
    setStatus("connecting");
    
    // Add user message to state immediately
    const userMsgId = `msg-${messageIdRef.current++}`;
    setMessages((prev) => [...prev, {
      id: userMsgId,
      role: "user",
      content: message,
      timestamp: new Date(),
    }]);
    
    // TODO: Wire to actual tRPC subscription
    // trpc.assistant.stream.useSubscription({
    //   thread,
    //   resource,
    //   messages: [{ role: "user", content: message }],
    // }, {
    //   onData: handleChunk,
    //   onError: (err) => {
    //     setError(err);
    //     setStatus("error");
    //     onError?.(err);
    //   },
    // });
  }, [thread, resource, handleChunk, onError]);

  // Clear state
  const clear = useCallback(() => {
    setMessages([]);
    setActions([]);
    setStatus("disconnected");
    setError(null);
    messageIdRef.current = 0;
    currentInputRef.current = null;
  }, []);

  return {
    messages,
    actions,
    status,
    error,
    send,
    clear,
  };
}

