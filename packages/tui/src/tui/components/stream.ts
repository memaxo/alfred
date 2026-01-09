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

export type ToolCallStatus = "pending" | "complete" | "error";

export type ActiveToolCall = {
  name: string;
  status: ToolCallStatus;
};

export type StreamState = {
  chunks: StreamChunk[];
  currentText: string;
  activeToolCalls: Map<string, ActiveToolCall>;
  isStreaming: boolean;
  error?: string;
};

export function createStreamState(): StreamState {
  return {
    chunks: [],
    currentText: "",
    activeToolCalls: new Map(),
    isStreaming: false,
  };
}

export function createStreamActions(
  get: () => StreamState,
  set: (next: StreamState) => void
): {
  addChunk: (chunk: StreamChunk) => void;
  setStreaming: (isStreaming: boolean) => void;
  reset: () => void;
} {
  const update = (fn: (prev: StreamState) => StreamState) => {
    set(fn(get()));
  };

  return {
    addChunk: (chunk) => {
      update((prev) => {
        const next: StreamState = {
          ...prev,
          chunks: [...prev.chunks, chunk],
        };

        if (chunk.type === "text") {
          next.currentText = prev.currentText + chunk.content;
          return next;
        }

        if (chunk.type === "tool-call-start") {
          const m = new Map(prev.activeToolCalls);
          m.set(chunk.toolCallId, { name: chunk.toolName, status: "pending" });
          next.activeToolCalls = m;
          return next;
        }

        if (chunk.type === "tool-call-result") {
          const m = new Map(prev.activeToolCalls);
          const existing = m.get(chunk.toolCallId);
          if (existing) {
            m.set(chunk.toolCallId, {
              ...existing,
              status: chunk.isError ? "error" : "complete",
            });
          }
          next.activeToolCalls = m;
          if (chunk.content) {
            next.currentText = prev.currentText + chunk.content;
          }
          return next;
        }

        if (chunk.type === "error") {
          next.error = chunk.content;
          next.isStreaming = false;
          return next;
        }

        if (chunk.type === "done") {
          next.isStreaming = false;
          return next;
        }

        return next;
      });
    },

    setStreaming: (isStreaming) => {
      update((prev) => ({
        ...prev,
        isStreaming,
        error: isStreaming ? undefined : prev.error,
      }));
    },

    reset: () => {
      set(createStreamState());
    },
  };
}

export function renderToolCalls(
  toolCalls: Map<string, ActiveToolCall>
): string[] {
  const lines: string[] = [];
  for (const [, call] of toolCalls) {
    const label =
      call.status === "pending"
        ? "Calling"
        : call.status === "complete"
          ? "Done"
          : "Failed";
    lines.push(`  ${label}: ${call.name}`);
  }
  return lines;
}
