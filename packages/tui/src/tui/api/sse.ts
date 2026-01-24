/**
 * ALFRED TUI SSE Client
 *
 * Server-Sent Events client for streaming assistant responses.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
      isError?: boolean;
    }
  | { type: "reasoning"; text: string };

export interface UIMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: UIMessagePart[];
}

// Back-compat alias for older callers.
export type Message = UIMessage;

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-call-result";
      toolCallId: string;
      content?: string;
      isError?: boolean;
    }
  | { type: "error"; content: string }
  | { type: "done" };

export interface SSEOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: StreamChunk) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

// ─── SSE Parser ──────────────────────────────────────────────────────────────

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // Split on double newlines (SSE event separator)
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      if (event.trim()) {
        yield event;
      }
    }
  }

  // Handle any remaining data
  if (buffer.trim()) {
    yield buffer;
  }
}

function parseSSEEvent(event: string): { type?: string; data?: string } {
  const lines = event.split("\n");
  let eventType: string | undefined;
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    } else if (line.startsWith(":")) {
      // Comment, ignore
    }
  }

  return { data, type: eventType };
}

// ─── Stream Assistant ────────────────────────────────────────────────────────

export async function* streamAssistant(
  messages: UIMessage[],
  options: SSEOptions = {}
): AsyncGenerator<StreamChunk> {
  const { baseUrl = "http://localhost:3000", signal } = options;
  const url = `${baseUrl}/api/assistant`;

  // Load credentials for auth
  let accessToken: string | undefined;
  try {
    const { loadCredentials } = await import("../../cli/credentials");
    const creds = await loadCredentials();
    accessToken = creds?.accessToken;
  } catch {
    // No credentials available
  }

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    body: JSON.stringify({ messages }),
    headers,
    method: "POST",
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    yield { content: error || `HTTP ${response.status}`, type: "error" };
    return;
  }

  if (!response.body) {
    yield { content: "No response body", type: "error" };
    return;
  }

  const reader =
    response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;

  try {
    for await (const event of parseSSEStream(reader)) {
      const parsed = parseSSEEvent(event);

      if (!parsed.data) {
        continue;
      }

      // Parse the data
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(parsed.data);
      } catch {
        // Not JSON, treat as raw text
        yield { content: parsed.data, type: "text" };
        continue;
      }

      // Map SSE events to StreamChunk
      const chunk = mapSSEToChunk(parsed.type, data);
      if (chunk) {
        yield chunk;
      }
    }

    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

function mapSSEToChunk(
  eventType: string | undefined,
  data: Record<string, unknown>
): StreamChunk | null {
  // Handle AI SDK stream format
  switch (eventType) {
    case "text-delta":
    case "text": {
      return {
        type: "text",
        content: String(data.text ?? data.textDelta ?? ""),
      };
    }

    case "tool-call": {
      return {
        type: "tool-call-start",
        toolCallId: String(data.toolCallId ?? ""),
        toolName: String(data.toolName ?? ""),
      };
    }

    case "tool-result": {
      return {
        type: "tool-call-result",
        toolCallId: String(data.toolCallId ?? ""),
        isError: Boolean(data.isError),
        content: String(data.result ?? data.output ?? ""),
      };
    }

    case "error": {
      return {
        type: "error",
        content: String(data.message ?? data.error ?? "Unknown error"),
      };
    }

    case "finish":
    case "done": {
      return { type: "done" };
    }

    default: {
      // Handle array format from AI SDK
      if (Array.isArray(data)) {
        for (const item of data) {
          if (typeof item === "object" && item !== null) {
            const itemData = item as Record<string, unknown>;
            if (itemData.type === "text-delta") {
              return {
                type: "text",
                content: String(itemData.textDelta ?? ""),
              };
            }
          }
        }
      }
      // Unknown event type, try to extract text
      if (data.text) {
        return { type: "text", content: String(data.text) };
      }
      if (data.content) {
        return { type: "text", content: String(data.content) };
      }
      return null;
    }
  }
}

// ─── Convenience Wrapper ─────────────────────────────────────────────────────

export async function sendMessage(
  content: string,
  history: UIMessage[],
  options: SSEOptions = {}
): Promise<{ response: string; error?: string }> {
  const messages: UIMessage[] = [...history, { content, role: "user" }];

  let response = "";
  let error: string | undefined;

  for await (const chunk of streamAssistant(messages, options)) {
    switch (chunk.type) {
      case "text": {
        response += chunk.content ?? "";
        options.onChunk?.(chunk);
        break;
      }

      case "error": {
        error = chunk.content;
        options.onChunk?.(chunk);
        break;
      }

      case "done": {
        options.onDone?.();
        break;
      }

      default: {
        options.onChunk?.(chunk);
      }
    }
  }

  return { error, response };
}
