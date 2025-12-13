import type { WorkflowEvent } from "@alfred/type";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";

type UiMessage = z.infer<typeof uiMessageSchema>;

export type WorkflowStreamInput = {
  requirement: string;
  authz: string;
  auto: "read" | "low" | "medium" | "high";
  mode: "sequential" | "parallel";
  [key: string]: unknown;
};

export type WorkflowStreamStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export type UseWorkflowSseStreamOptions = {
  input: WorkflowStreamInput | null;
  onWorkflowEvent?: (event: WorkflowEvent) => void;
  onUiMessages?: (
    messages: UiMessage[],
    meta: { runId: string; eventId: string; eventType: string }
  ) => void;
  onError?: (error: Error) => void;
};

export type UseWorkflowSseStreamReturn = {
  status: WorkflowStreamStatus;
  error: Error | null;
};

type ParsedEvent = {
  event: string;
  data: string;
};

type WorkflowStreamHarness = {
  subscribe: (options: {
    input: WorkflowStreamInput;
    onWorkflowEvent?: (event: WorkflowEvent) => void;
    onUiMessages?: (
      messages: UiMessage[],
      meta: { runId: string; eventId: string; eventType: string }
    ) => void;
    onError?: (error: Error) => void;
  }) => { close: () => void } | void;
};

declare global {
  // eslint-disable-next-line no-var
  var __workflowStreamTestHarness__: WorkflowStreamHarness | undefined;
}

function getWorkflowStreamHarness(): WorkflowStreamHarness | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const scope = globalThis as {
    __workflowStreamTestHarness__?: WorkflowStreamHarness;
  };
  return scope.__workflowStreamTestHarness__ ?? null;
}

const decoder = new TextDecoder();

export function useWorkflowSseStream(
  options: UseWorkflowSseStreamOptions
): UseWorkflowSseStreamReturn {
  const { input, onWorkflowEvent, onUiMessages, onError } = options;
  const [status, setStatus] = useState<WorkflowStreamStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const workflowEventRef = useRef(onWorkflowEvent);
  const uiMessagesRef = useRef(onUiMessages);
  const errorRef = useRef(onError);

  useEffect(() => {
    workflowEventRef.current = onWorkflowEvent;
  }, [onWorkflowEvent]);

  useEffect(() => {
    uiMessagesRef.current = onUiMessages;
  }, [onUiMessages]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!input) {
      setStatus("idle");
      setError(null);
      return () => {};
    }

    let isCancelled = false;
    const controller = new AbortController();

    const harness = getWorkflowStreamHarness();
    if (harness) {
      setStatus("open");
      setError(null);
      const subscription = harness.subscribe({
        input,
        onWorkflowEvent: (event) => {
          workflowEventRef.current?.(event);
        },
        onUiMessages: (messages, meta) => {
          uiMessagesRef.current?.(messages, meta);
        },
        onError: (err) => {
          const wrapped = err instanceof Error ? err : new Error(String(err));
          setError(wrapped);
          setStatus("error");
          errorRef.current?.(wrapped);
        },
      });
      return () => {
        subscription?.close?.();
      };
    }

    async function connect() {
      setStatus("connecting");
      setError(null);

      try {
        const response = await fetch("/api/workflow/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!(response.ok && response.body)) {
          throw new Error(`workflow_stream_http_${response.status}`);
        }

        setStatus("open");
        const reader = response.body.getReader();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = drainEvents(buffer, (parsed) => dispatchEvent(parsed));
        }

        if (!isCancelled) {
          setStatus((current) => (current === "error" ? current : "closed"));
        }
      } catch (err) {
        if (isCancelled || controller.signal.aborted) {
          return;
        }
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        setStatus("error");
        errorRef.current?.(wrapped);
      }
    }

    function dispatchEvent(parsed: ParsedEvent) {
      try {
        if (!parsed.data) {
          return;
        }
        const payload = JSON.parse(parsed.data);
        if (parsed.event === "workflow-event") {
          workflowEventRef.current?.(payload as WorkflowEvent);
        } else if (parsed.event === "ui-message") {
          const { messages, meta } = payload as {
            messages: UiMessage[];
            meta: { runId: string; eventId: string; eventType: string };
          };
          if (Array.isArray(messages)) {
            uiMessagesRef.current?.(messages, meta);
          }
        } else if (parsed.event === "error") {
          const wrapped = new Error(
            typeof payload?.message === "string"
              ? payload.message
              : "workflow_stream_error"
          );
          setError(wrapped);
          setStatus("error");
          errorRef.current?.(wrapped);
          controller.abort();
        } else if (parsed.event === "complete") {
          setStatus("closed");
          controller.abort();
        }
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        setStatus("error");
        errorRef.current?.(wrapped);
        controller.abort();
      }
    }

    void connect();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [input]);

  return { status, error };
}

function drainEvents(
  buffer: string,
  emit: (event: ParsedEvent) => void
): string {
  while (true) {
    const separatorIndex = buffer.indexOf("\n\n");
    if (separatorIndex === -1) {
      break;
    }
    const rawEvent = buffer.slice(0, separatorIndex);
    buffer = buffer.slice(separatorIndex + 2);

    const parsed = parseEvent(rawEvent);
    if (parsed) {
      emit(parsed);
    }
  }
  return buffer;
}

function parseEvent(raw: string): ParsedEvent | null {
  const lines = raw.split("\n");
  let eventName = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      const chunk = line.slice("data:".length);
      data = data.length ? `${data}\n${chunk}` : chunk;
    }
  }
  if (!(eventName || data)) {
    return null;
  }
  return { event: eventName, data: data.trim() };
}
