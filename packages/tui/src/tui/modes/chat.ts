/**
 * ALFRED TUI Chat Mode
 *
 * Interactive conversation with the assistant using SSE streaming.
 */

import { streamAssistant, type UIMessage } from "../api/sse";
import {
  createMessageHistoryActions,
  createMessageHistoryState,
  type MessageHistoryState,
  renderMessageHistory,
} from "../components/history";
import {
  createInputLineActions,
  createInputLineState,
  handleInputLineKey,
  type InputLineState,
  renderInputLine,
} from "../components/input";
import {
  CHAT_HINTS,
  createStatusBarState,
  renderHintBar,
  type StatusBarState,
} from "../components/status";
import {
  createStreamActions,
  createStreamState,
  type StreamState,
} from "../components/stream";
import type { KeyEvent } from "../input/keys";
import { isEscape } from "../input/keys";
import type { TerminalSize } from "../renderer";
import { boxBottom, boxSide, boxTop, dim, padRight } from "../typography";
import { BaseMode, type ModeCallbacks } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatModeState = {
  input: InputLineState;
  history: MessageHistoryState;
  stream: StreamState;
  status: StatusBarState;
  currentAssistantMessageId: string | null;
  abortController: AbortController | null;
  frame: number;
};

// ─── Chat Mode ───────────────────────────────────────────────────────────────

export class ChatMode extends BaseMode {
  private state!: ChatModeState;
  private inputActions!: ReturnType<typeof createInputLineActions>;
  private historyActions!: ReturnType<typeof createMessageHistoryActions>;
  private streamActions!: ReturnType<typeof createStreamActions>;

  constructor(callbacks: ModeCallbacks = {}) {
    super(callbacks);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  protected init(): void {
    this.state = {
      input: createInputLineState("Type a message..."),
      history: createMessageHistoryState(),
      stream: createStreamState(),
      status: {
        ...createStatusBarState("ALFRED Chat"),
        connectionStatus: "disconnected",
        keyHints: CHAT_HINTS,
      },
      currentAssistantMessageId: null,
      abortController: null,
      frame: 0,
    };

    // Create actions
    this.inputActions = createInputLineActions(
      () => this.state.input,
      (input) => {
        this.state.input = input;
      }
    );

    this.historyActions = createMessageHistoryActions(
      () => this.state.history,
      (history) => {
        this.state.history = history;
      }
    );

    this.streamActions = createStreamActions(
      () => this.state.stream,
      (stream) => {
        this.state.stream = stream;
      }
    );

    // Mark as connected (optimistic)
    this.state.status.connectionStatus = "connected";
  }

  protected cleanup(): void {
    // Cancel any pending stream
    if (this.state.abortController) {
      this.state.abortController.abort();
    }
  }

  // ─── Input Handling ──────────────────────────────────────────────────────────

  protected handleKey(event: KeyEvent): boolean {
    // Escape to exit
    if (isEscape(event)) {
      this.exit();
      return true;
    }

    // Cancel streaming with Ctrl+C
    if (event.ctrl && event.key === "c" && this.state.stream.isStreaming) {
      this.cancelStream();
      return true;
    }

    // Scroll history
    if (event.key === "pageup") {
      this.historyActions.scrollUp(5);
      return true;
    }

    if (event.key === "pagedown") {
      this.historyActions.scrollDown(5);
      return true;
    }

    // Input line handling
    if (
      handleInputLineKey(event, this.inputActions, (message) => {
        void this.sendMessage(message);
      })
    ) {
      return true;
    }

    return false;
  }

  // ─── Messaging ───────────────────────────────────────────────────────────────

  private async sendMessage(content: string): Promise<void> {
    if (this.state.stream.isStreaming) {
      return;
    }

    // Add user message
    this.historyActions.addMessage({
      role: "user",
      content,
      status: "complete",
    });

    // Add pending assistant message
    const assistantId = this.historyActions.addMessage({
      role: "assistant",
      content: "",
      status: "streaming",
    });
    this.state.currentAssistantMessageId = assistantId;

    // Start streaming
    this.streamActions.setStreaming(true);
    this.state.abortController = new AbortController();

    try {
      // Build message history for API
      const messages = this.buildMessages();

      // Stream response
      for await (const chunk of streamAssistant(messages, {
        signal: this.state.abortController.signal,
      })) {
        switch (chunk.type) {
          case "text":
            if (chunk.content) {
              this.historyActions.appendToMessage(assistantId, chunk.content);
            }
            break;

          case "tool-call-start":
            if (chunk.toolName) {
              this.historyActions.appendToMessage(
                assistantId,
                `\n> Calling ${chunk.toolName}...`
              );
            }
            break;

          case "tool-call-result":
            // Tool result handled implicitly
            break;

          case "error":
            this.historyActions.updateMessage(assistantId, {
              status: "error",
              content: `${
                this.state.history.messages.find((m) => m.id === assistantId)
                  ?.content
              }\n\nError: ${chunk.content}`,
            });
            break;

          case "done":
            this.historyActions.updateMessage(assistantId, {
              status: "complete",
            });
            break;
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        this.historyActions.updateMessage(assistantId, {
          status: "error",
          content: `Error: ${(error as Error).message}`,
        });
      }
    } finally {
      this.streamActions.setStreaming(false);
      this.state.abortController = null;
      this.state.currentAssistantMessageId = null;
    }
  }

  private buildMessages(): UIMessage[] {
    return this.state.history.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
  }

  private cancelStream(): void {
    if (this.state.abortController) {
      this.state.abortController.abort();
    }
    if (this.state.currentAssistantMessageId) {
      this.historyActions.updateMessage(this.state.currentAssistantMessageId, {
        status: "error",
        content: `${
          this.state.history.messages.find(
            (m) => m.id === this.state.currentAssistantMessageId
          )?.content
        }\n\n[Cancelled]`,
      });
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  protected render(size: TerminalSize): string[] {
    this.state.frame++;
    const lines: string[] = [];
    const { width, height } = size;

    // Layout: Header (1) + History (dynamic) + Separator (1) + Input (1) + Hints (1)
    const headerHeight = 1;
    const inputHeight = 1;
    const separatorHeight = 1;
    const hintsHeight = 1;
    const historyHeight = Math.max(
      1,
      height - headerHeight - inputHeight - separatorHeight - hintsHeight - 2
    );

    // Header
    lines.push(boxTop(width, "ALFRED Chat", true));

    // Message history
    const historyLines = renderMessageHistory(
      this.state.history,
      width - 2,
      historyHeight
    );
    for (const line of historyLines) {
      lines.push(
        `${boxSide(true)}${padRight(line, width - 2)}${boxSide(true)}`
      );
    }

    // Separator
    lines.push(`${boxSide(true)}${dim("─".repeat(width - 2))}${boxSide(true)}`);

    // Input line
    const inputLine = renderInputLine(this.state.input, width - 4, {
      prompt: "> ",
      showCursor: !this.state.stream.isStreaming,
    });
    lines.push(
      `${boxSide(true)} ${padRight(inputLine, width - 4)} ${boxSide(true)}`
    );

    // Bottom border
    lines.push(boxBottom(width, true));

    // Hints
    lines.push(renderHintBar(this.state.status.keyHints, width));

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createChatMode(callbacks: ModeCallbacks = {}): ChatMode {
  return new ChatMode(callbacks);
}

export function runChatMode(): Promise<void> {
  const mode = createChatMode();
  return new Promise((resolve) => {
    mode.callbacks.onExit = () => resolve();
    mode.start();
  });
}
