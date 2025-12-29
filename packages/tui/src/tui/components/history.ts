/**
 * ALFRED TUI Message History Component
 *
 * Scrollable message list with role-based styling.
 */

import { colors } from "../theme";
import { bold, dim, fg } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: "pending" | "streaming" | "complete" | "error";
  toolName?: string;
};

export type MessageHistoryState = {
  messages: Message[];
  scrollOffset: number;
  autoScroll: boolean;
};

export type MessageHistoryActions = {
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  appendToMessage: (id: string, content: string) => void;
  scrollUp: (lines?: number) => void;
  scrollDown: (lines?: number) => void;
  scrollToBottom: () => void;
  clear: () => void;
};

// ─── State Factory ───────────────────────────────────────────────────────────

export function createMessageHistoryState(): MessageHistoryState {
  return {
    messages: [],
    scrollOffset: 0,
    autoScroll: true,
  };
}

// ─── Actions Factory ─────────────────────────────────────────────────────────

let messageCounter = 0;

/**
 * Reset message counter for testing.
 * @internal Only use in tests
 */
export function resetMessageCounter(): void {
  messageCounter = 0;
}

export function createMessageHistoryActions(
  getState: () => MessageHistoryState,
  setState: (state: MessageHistoryState) => void
): MessageHistoryActions {
  return {
    addMessage: (message) => {
      const id = `msg_${++messageCounter}`;
      const newMessage: Message = {
        ...message,
        id,
        timestamp: new Date(),
      };
      const state = getState();
      setState({
        ...state,
        messages: [...state.messages, newMessage],
        // Auto-scroll to bottom when new message arrives
        scrollOffset: state.autoScroll ? 0 : state.scrollOffset,
      });
      return id;
    },

    updateMessage: (id, updates) => {
      const state = getState();
      setState({
        ...state,
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      });
    },

    appendToMessage: (id, content) => {
      const state = getState();
      setState({
        ...state,
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, content: m.content + content } : m
        ),
      });
    },

    scrollUp: (lines = 1) => {
      const state = getState();
      setState({
        ...state,
        scrollOffset: state.scrollOffset + lines,
        autoScroll: false,
      });
    },

    scrollDown: (lines = 1) => {
      const state = getState();
      const newOffset = Math.max(0, state.scrollOffset - lines);
      setState({
        ...state,
        scrollOffset: newOffset,
        autoScroll: newOffset === 0,
      });
    },

    scrollToBottom: () => {
      setState({
        ...getState(),
        scrollOffset: 0,
        autoScroll: true,
      });
    },

    clear: () => {
      setState({
        messages: [],
        scrollOffset: 0,
        autoScroll: true,
      });
    },
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function roleColor(role: MessageRole): string {
  switch (role) {
    case "user":
      return colors.primary;
    case "assistant":
      return colors.success;
    case "system":
      return colors.warning;
    case "tool":
      return colors.textMuted;
  }
}

function roleLabel(role: MessageRole): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Alfred";
    case "system":
      return "System";
    case "tool":
      return "Tool";
  }
}

function statusIndicator(status?: Message["status"]): string {
  switch (status) {
    case "pending":
      return fg(colors.muted)("○");
    case "streaming":
      return fg(colors.primary)("●");
    case "error":
      return fg(colors.error)("✗");
    default:
      return "";
  }
}

export function renderMessage(message: Message, width: number): string[] {
  const lines: string[] = [];
  const color = roleColor(message.role);
  const label = roleLabel(message.role);
  const time = formatTimestamp(message.timestamp);
  const status = statusIndicator(message.status);

  // Header line
  const header = `${dim(time)} ${fg(color)(bold(label))}${message.toolName ? dim(` (${message.toolName})`) : ""}${status ? ` ${status}` : ""}`;
  lines.push(header);

  // Content lines - wrap text
  const contentWidth = width - 2;
  const contentLines = wrapText(message.content, contentWidth);
  for (const line of contentLines) {
    lines.push(`  ${line}`);
  }

  // Empty line after message
  lines.push("");

  return lines;
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";
    const words = paragraph.split(" ");

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export function renderMessageHistory(
  state: MessageHistoryState,
  width: number,
  height: number
): string[] {
  if (state.messages.length === 0) {
    const emptyMessage = dim(
      "No messages yet. Start typing to chat with Alfred."
    );
    const paddedLines = Math.floor(height / 2);
    const lines: string[] = [];
    for (let i = 0; i < paddedLines; i++) {
      lines.push("");
    }
    lines.push(emptyMessage);
    return lines;
  }

  // Render all messages
  const allLines: string[] = [];
  for (const message of state.messages) {
    const messageLines = renderMessage(message, width);
    allLines.push(...messageLines);
  }

  // Apply scroll offset (from bottom)
  const totalLines = allLines.length;
  const visibleStart = Math.max(0, totalLines - height - state.scrollOffset);
  const visibleEnd = Math.min(totalLines, visibleStart + height);

  const visibleLines = allLines.slice(visibleStart, visibleEnd);

  // Pad to fill height
  while (visibleLines.length < height) {
    visibleLines.unshift("");
  }

  return visibleLines;
}

// ─── Scroll Indicator ────────────────────────────────────────────────────────

export function renderScrollIndicator(
  state: MessageHistoryState,
  _totalHeight: number,
  _visibleHeight: number
): string | null {
  if (state.scrollOffset === 0) {
    return null;
  }

  return dim(`↑ ${state.scrollOffset} more lines`);
}
