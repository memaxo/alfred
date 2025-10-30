/**
 * useAssistantStream Hook
 *
 * Wires the assistant tRPC stream into React state with zero-flicker updates.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import { trpc } from "@/utils/trpc";
import type { TRPCAppRouter } from "@/utils/trpc";

type StatusState = "connecting" | "connected" | "disconnected" | "error";
type ActionStatus = "pending" | "running" | "completed" | "error";
type MessageRole = "user" | "assistant" | "orchestrator";

export interface AssistantMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface AssistantAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: ActionStatus;
  result?: unknown;
  error?: string;
}

interface UseAssistantStreamOptions {
  thread?: string;
  resource?: string;
  onError?: (error: Error) => void;
}

interface UseAssistantStreamReturn {
  messages: AssistantMessage[];
  actions: AssistantAction[];
  status: StatusState;
  error: Error | null;
  send: (message: string) => void;
  clear: () => void;
}

type RouterInputs = inferRouterInputs<TRPCAppRouter>;
type AssistantStreamInput = RouterInputs["assistant"]["stream"];

export type NormalizedAssistantChunk =
  | { kind: "run"; runId: string | null }
  | { kind: "status"; status: StatusState }
  | {
      kind: "message";
      id?: string;
      role: MessageRole;
      delta: string;
      cumulative?: string | null;
      ts?: number;
    }
  | {
      kind: "action";
      id: string;
      tool: string;
      args: Record<string, unknown>;
      status: ActionStatus;
      result?: unknown;
      error?: string;
    }
  | { kind: "cache"; key: readonly unknown[]; value: unknown; merge: boolean }
  | { kind: "final"; text?: string | null }
  | { kind: "error"; error: Error }
  | { kind: "ignore" };

const STATUS_VALUES: StatusState[] = ["connecting", "connected", "disconnected", "error"];

function toStatus(value: unknown): StatusState | null {
  if (typeof value !== "string") return null;
  return STATUS_VALUES.includes(value as StatusState) ? (value as StatusState) : null;
}

function toRole(value: unknown): MessageRole {
  if (value === "user" || value === "assistant" || value === "orchestrator") {
    return value;
  }
  return "assistant";
}

function toActionStatus(value: unknown, fallback: ActionStatus): ActionStatus {
  if (value === "pending" || value === "running" || value === "completed" || value === "error") {
    return value;
  }
  return fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessagePayload(chunk: Record<string, unknown>) {
  return isPlainObject(chunk.data) ? (chunk.data as Record<string, unknown>) : chunk;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function parseAssistantChunk(raw: Record<string, unknown>): NormalizedAssistantChunk {
  if (!isPlainObject(raw)) {
    return { kind: "ignore" };
  }

  const type = safeString(raw.type)?.toLowerCase();
  if (!type) {
    return { kind: "ignore" };
  }

  if (type === "run") {
    const runId = safeString(raw.runId) ?? safeString(raw.id) ?? null;
    return { kind: "run", runId };
  }

  if (type === "status") {
    const status = toStatus(raw.state ?? raw.status);
    return status ? { kind: "status", status } : { kind: "ignore" };
  }

  if (type === "message" || type === "message-delta" || type === "text-delta") {
    const payload = getMessagePayload(raw);
    const delta = safeString(payload.delta ?? raw.delta) ?? "";
    const cumulative = safeString(payload.cumulative ?? raw.cumulative);
    const id = safeString(payload.id ?? raw.id ?? raw.messageId);
    const ts = safeNumber(payload.ts ?? raw.ts);
    const role = toRole(payload.role ?? raw.role);
    return {
      kind: "message",
      id,
      role,
      delta,
      cumulative,
      ts,
    };
  }

  if (type === "tool-call" || type === "tool_call") {
    const payload = isPlainObject(raw.toolCall) ? (raw.toolCall as Record<string, unknown>) : raw;
    const id =
      safeString(payload.toolCallId ?? payload.id) ??
      `tool-${safeString(raw.id) ?? ""}`.replace(/-$/, "");
    const tool = safeString(payload.toolName ?? payload.name ?? payload.tool) ?? "tool";
    const args = isPlainObject(payload.args) ? payload.args : {};
    return {
      kind: "action",
      id,
      tool,
      args,
      status: "running",
    };
  }

  if (type === "tool-result" || type === "tool_result") {
    const payload = isPlainObject(raw.toolCall) ? (raw.toolCall as Record<string, unknown>) : raw;
    const id = safeString(raw.toolCallId ?? payload.toolCallId ?? payload.id);
    if (!id) return { kind: "ignore" };
    const tool =
      safeString(raw.toolName ?? payload.toolName ?? payload.name ?? payload.tool) ?? "tool";
    const args = isPlainObject(payload.args) ? payload.args : {};
    const result = raw.result ?? payload.result ?? raw.output ?? payload.output ?? raw.data;
    const errorMessage = safeString(raw.error ?? payload.error);
    return {
      kind: "action",
      id,
      tool,
      args,
      result,
      error: errorMessage ?? undefined,
      status: errorMessage ? "error" : "completed",
    };
  }

  if (type === "action") {
    const id = safeString(raw.id);
    if (!id) return { kind: "ignore" };
    const tool = safeString(raw.tool ?? raw.name) ?? "tool";
    const args = isPlainObject(raw.args) ? (raw.args as Record<string, unknown>) : {};
    const status = toActionStatus(raw.status, "running");
    const errorMessage = safeString(raw.error);
    const result = raw.result ?? raw.output ?? raw.data;
    return {
      kind: "action",
      id,
      tool,
      args,
      status: errorMessage ? "error" : status,
      result,
      error: errorMessage ?? undefined,
    };
  }

  if (type === "data-cache-handoff" || type === "cache_handoff") {
    const key = Array.isArray(raw.key) ? (raw.key as readonly unknown[]) : undefined;
    if (!key) {
      return { kind: "ignore" };
    }
    const merge = Boolean(raw.merge);
    return {
      kind: "cache",
      key,
      value: raw.value,
      merge,
    };
  }

  if (type === "final") {
    const payload = isPlainObject(raw.data) ? (raw.data as Record<string, unknown>) : raw;
    const text = safeString(payload.text ?? payload.message ?? payload.cumulative);
    return { kind: "final", text: text ?? null };
  }

  if (type === "error") {
    const message = safeString(raw.message) ?? "assistant_stream_error";
    const code = safeString(raw.code);
    const error = new Error(message);
    if (code) {
      error.name = code;
    }
    return { kind: "error", error };
  }

  return { kind: "ignore" };
}

export function updateMessages(
  list: AssistantMessage[],
  update: { id: string; role: MessageRole; content: string; ts?: number },
): AssistantMessage[] {
  if (!update.content) {
    return list;
  }
  const ts = update.ts ? new Date(update.ts) : new Date();
  const index = list.findIndex(msg => msg.id === update.id);
  if (index >= 0) {
    const current = list[index];
    if (current.content === update.content && current.role === update.role) {
      return list;
    }
    const next = list.slice();
    next[index] = { ...current, content: update.content, role: update.role, timestamp: ts };
    return next;
  }
  return [...list, { id: update.id, role: update.role, content: update.content, timestamp: ts }];
}

export function updateActions(list: AssistantAction[], action: AssistantAction): AssistantAction[] {
  const index = list.findIndex(item => item.id === action.id);
  if (index >= 0) {
    const current = list[index];
    if (
      current.status === action.status &&
      current.tool === action.tool &&
      current.result === action.result &&
      current.error === action.error &&
      current.args === action.args
    ) {
      return list;
    }
    const next = list.slice();
    next[index] = { ...current, ...action };
    return next;
  }
  return [...list, action];
}

export function useAssistantStream({
  thread,
  resource,
  onError,
}: UseAssistantStreamOptions = {}): UseAssistantStreamReturn {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [status, setStatus] = useState<StatusState>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [streamInput, setStreamInput] = useState<AssistantStreamInput | null>(null);

  const messageIdRef = useRef(0);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);

  const handleNormalizedChunk = useCallback(
    (normalized: NormalizedAssistantChunk) => {
      switch (normalized.kind) {
        case "run": {
          setStatus("connected");
          setError(null);
          return;
        }
        case "status": {
          setStatus(normalized.status);
          if (normalized.status !== "error") {
            setError(null);
          }
          return;
        }
        case "message": {
          setStatus("connected");
          const existingId =
            normalized.id ??
            activeAssistantMessageIdRef.current ??
            `msg-${messageIdRef.current++}`;
          activeAssistantMessageIdRef.current = existingId;
          setMessages(prev => {
            const current = prev.find(msg => msg.id === existingId);
            const base = current?.content ?? "";
            let nextContent = base + normalized.delta;
            if (normalized.cumulative !== undefined && normalized.cumulative !== null) {
              nextContent = normalized.cumulative;
              if (!nextContent && normalized.delta) {
                nextContent = base + normalized.delta;
              }
            }
            return updateMessages(prev, {
              id: existingId,
              role: normalized.role,
              content: nextContent,
              ts: normalized.ts,
            });
          });
          return;
        }
        case "action": {
          const action: AssistantAction = {
            id: normalized.id,
            tool: normalized.tool,
            args: normalized.args,
            status: normalized.status,
            result: normalized.result,
            error: normalized.error,
          };
          setActions(prev => updateActions(prev, action));
          return;
        }
        case "cache": {
          const { key, value, merge } = normalized;
          if (merge && isPlainObject(value)) {
            queryClient.setQueryData(key, oldValue => {
              if (isPlainObject(oldValue)) {
                return { ...(oldValue as Record<string, unknown>), ...value };
              }
              return value;
            });
          } else {
            queryClient.setQueryData(key, value);
          }
          return;
        }
        case "final": {
          if (typeof normalized.text === "string" && normalized.text.length > 0) {
            const id =
              activeAssistantMessageIdRef.current ?? `msg-${messageIdRef.current++}`;
            activeAssistantMessageIdRef.current = id;
            setMessages(prev =>
              updateMessages(prev, {
                id,
                role: "assistant",
                content: normalized.text,
              }),
            );
          }
          return;
        }
        case "error": {
          setError(normalized.error);
          setStatus("error");
          activeAssistantMessageIdRef.current = null;
          onError?.(normalized.error);
          return;
        }
        case "ignore": {
          return;
        }
      }
    },
    [onError, queryClient],
  );

  const handleChunk = useCallback(
    (chunk: Record<string, unknown>) => {
      const normalized = parseAssistantChunk(chunk);
      if (normalized.kind === "ignore") return;
      handleNormalizedChunk(normalized);
    },
    [handleNormalizedChunk],
  );

  const send = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      subscriptionRef.current?.();
      subscriptionRef.current = null;

      const id = `msg-${messageIdRef.current++}`;
      const userMessage: AssistantMessage = {
        id,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setStatus("connecting");
      setError(null);
      setActions([]);
      activeAssistantMessageIdRef.current = null;

      const conversation = [...messages, userMessage]
        .filter(msg => msg.role === "user" || msg.role === "assistant")
        .map(msg => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        }));

      const payload: AssistantStreamInput = {
        messages: conversation,
      };

      if (thread) {
        payload.thread = thread;
      }
      if (resource) {
        payload.resource = resource;
      }

      setStreamInput(payload);
    },
    [messages, resource, thread],
  );

  const clear = useCallback(() => {
    subscriptionRef.current?.();
    subscriptionRef.current = null;
    setStreamInput(null);
    setMessages([]);
    setActions([]);
    setStatus("disconnected");
    setError(null);
    messageIdRef.current = 0;
    activeAssistantMessageIdRef.current = null;
  }, []);

  const subscriptionArgs = streamInput ?? undefined;

  trpc.assistant.stream.useSubscription(subscriptionArgs as any, {
    enabled: Boolean(streamInput),
    onStarted(unsubscribe) {
      subscriptionRef.current = unsubscribe;
      setStatus("connecting");
      setError(null);
    },
    onData(chunk) {
      handleChunk(chunk as Record<string, unknown>);
    },
    onError(err) {
      subscriptionRef.current?.();
      subscriptionRef.current = null;
      setStreamInput(null);
      const parsed = err instanceof Error ? err : new Error(String(err));
      setError(parsed);
      setStatus("error");
      onError?.(parsed);
    },
    onComplete() {
      subscriptionRef.current?.();
      subscriptionRef.current = null;
      activeAssistantMessageIdRef.current = null;
      setStreamInput(null);
      setStatus("disconnected");
    },
  });

  return useMemo(
    () => ({
      messages,
      actions,
      status,
      error,
      send,
      clear,
    }),
    [actions, clear, error, messages, send, status],
  );
}
