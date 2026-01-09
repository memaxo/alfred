export type MessageRole = "user" | "assistant";
export type MessageStatus = "streaming" | "complete" | "error";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
};

export type MessageHistoryState = {
  messages: ChatMessage[];
  scrollOffset: number;
  autoScroll: boolean;
};

let messageCounter = 0;

export function resetMessageCounter(): void {
  messageCounter = 0;
}

export function createMessageHistoryState(): MessageHistoryState {
  return { messages: [], scrollOffset: 0, autoScroll: true };
}

export function createMessageHistoryActions(
  get: () => MessageHistoryState,
  set: (next: MessageHistoryState) => void
): {
  addMessage: (msg: Omit<ChatMessage, "id">) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, "id">>) => void;
  appendToMessage: (id: string, chunk: string) => void;
  scrollUp: (lines: number) => void;
  scrollDown: (lines: number) => void;
  scrollToBottom: () => void;
} {
  const update = (fn: (prev: MessageHistoryState) => MessageHistoryState) => {
    set(fn(get()));
  };

  return {
    addMessage: (msg) => {
      const id = `m_${++messageCounter}`;
      update((prev) => ({
        ...prev,
        messages: [...prev.messages, { ...msg, id }],
        scrollOffset: prev.autoScroll ? 0 : prev.scrollOffset,
      }));
      return id;
    },

    updateMessage: (id, patch) => {
      update((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      }));
    },

    appendToMessage: (id, chunk) => {
      update((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === id ? { ...m, content: m.content + chunk } : m
        ),
      }));
    },

    scrollUp: (lines) => {
      const n = Math.max(0, lines);
      update((prev) => ({
        ...prev,
        scrollOffset: prev.scrollOffset + n,
        autoScroll: false,
      }));
    },

    scrollDown: (lines) => {
      const n = Math.max(0, lines);
      update((prev) => ({
        ...prev,
        scrollOffset: Math.max(0, prev.scrollOffset - n),
        autoScroll: Math.max(0, prev.scrollOffset - n) === 0,
      }));
    },

    scrollToBottom: () => {
      update((prev) => ({ ...prev, scrollOffset: 0, autoScroll: true }));
    },
  };
}
