/**
 * ALFRED TUI Stream Renderer Component
 *
 * Renders streaming text with tool call indicators.
 */

import { colors, icons } from "../theme";
import { bold, dim, fg } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StreamChunkType =
  | "text"
  | "tool-call-start"
  | "tool-call-result"
  | "reasoning"
  | "error"
  | "done";

export type StreamChunk = {
  type: StreamChunkType;
  content?: string;
  toolName?: string;
  toolCallId?: string;
  isError?: boolean;
};

export type StreamState = {
  chunks: StreamChunk[];
  currentText: string;
  activeToolCalls: Map<
    string,
    { name: string; status: "pending" | "complete" | "error" }
  >;
  isStreaming: boolean;
  error?: string;
};

export type StreamActions = {
  addChunk: (chunk: StreamChunk) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string) => void;
  reset: () => void;
};

// ─── State Factory ───────────────────────────────────────────────────────────

export function createStreamState(): StreamState {
  return {
    chunks: [],
    currentText: "",
    activeToolCalls: new Map(),
    isStreaming: false,
    error: undefined,
  };
}

// ─── Actions Factory ─────────────────────────────────────────────────────────

export function createStreamActions(
  getState: () => StreamState,
  setState: (state: StreamState) => void
): StreamActions {
  return {
    addChunk: (chunk) => {
      const state = getState();
      const newState = { ...state, chunks: [...state.chunks, chunk] };

      switch (chunk.type) {
        case "text":
          newState.currentText += chunk.content ?? "";
          break;

        case "tool-call-start":
          if (chunk.toolCallId && chunk.toolName) {
            newState.activeToolCalls = new Map(state.activeToolCalls);
            newState.activeToolCalls.set(chunk.toolCallId, {
              name: chunk.toolName,
              status: "pending",
            });
          }
          break;

        case "tool-call-result":
          if (chunk.toolCallId) {
            newState.activeToolCalls = new Map(state.activeToolCalls);
            const call = newState.activeToolCalls.get(chunk.toolCallId);
            if (call) {
              newState.activeToolCalls.set(chunk.toolCallId, {
                ...call,
                status: chunk.isError ? "error" : "complete",
              });
            }
          }
          break;

        case "error":
          newState.error = chunk.content;
          newState.isStreaming = false;
          break;

        case "done":
          newState.isStreaming = false;
          break;
      }

      setState(newState);
    },

    setStreaming: (streaming) => {
      setState({
        ...getState(),
        isStreaming: streaming,
      });
    },

    setError: (error) => {
      setState({
        ...getState(),
        error,
        isStreaming: false,
      });
    },

    reset: () => {
      setState(createStreamState());
    },
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Render active tool calls
 */
export function renderToolCalls(
  activeToolCalls: Map<
    string,
    { name: string; status: "pending" | "complete" | "error" }
  >
): string[] {
  const lines: string[] = [];

  for (const [, call] of activeToolCalls) {
    let icon: string;
    let color: string;

    switch (call.status) {
      case "pending":
        icon = icons.pending;
        color = colors.primary;
        break;
      case "complete":
        icon = icons.success;
        color = colors.success;
        break;
      case "error":
        icon = icons.error;
        color = colors.error;
        break;
    }

    const statusText =
      call.status === "pending"
        ? "Calling"
        : call.status === "complete"
          ? "Done"
          : "Failed";
    lines.push(
      `  ${fg(color)(icon)} ${bold(call.name)} ${dim(`(${statusText})`)}`
    );
  }

  return lines;
}

/**
 * Render streaming indicator
 */
export function renderStreamingIndicator(frame: number): string {
  const spinnerChars = icons.spinner;
  const spinnerChar = spinnerChars[frame % spinnerChars.length];
  return fg(colors.primary)(spinnerChar ?? "⠋");
}

/**
 * Render stream content with tool calls
 */
export function renderStreamContent(
  state: StreamState,
  width: number,
  frame: number
): string[] {
  const lines: string[] = [];

  // Show error if present
  if (state.error) {
    lines.push(fg(colors.error)(`Error: ${state.error}`));
    return lines;
  }

  // Show tool calls
  if (state.activeToolCalls.size > 0) {
    const toolLines = renderToolCalls(state.activeToolCalls);
    lines.push(...toolLines);
    if (state.currentText) {
      lines.push("");
    }
  }

  // Show current text
  if (state.currentText) {
    const textLines = wrapTextSimple(state.currentText, width);
    lines.push(...textLines);
  }

  // Show streaming indicator
  if (state.isStreaming && !state.error) {
    const lastLine = lines.at(-1) ?? "";
    const indicator = renderStreamingIndicator(frame);
    if (lastLine) {
      lines[lines.length - 1] = `${lastLine} ${indicator}`;
    } else {
      lines.push(indicator);
    }
  }

  return lines;
}

function wrapTextSimple(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
    } else {
      let remaining = paragraph;
      while (remaining.length > width) {
        // Find last space within width
        let breakPoint = remaining.lastIndexOf(" ", width);
        if (breakPoint === -1 || breakPoint === 0) {
          breakPoint = width;
        }
        lines.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint).trimStart();
      }
      if (remaining) {
        lines.push(remaining);
      }
    }
  }

  return lines;
}
