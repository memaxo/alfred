import type { ThreadEvent, ThreadItem } from "@alfred/protocol";

import type { CodexStreamOptions } from "../stream-client";

type RawCodexStreamEvent =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "notice"; message: string; usage?: unknown }
  | { type: "codex_event"; event: unknown }
  | {
      type: "complete";
      result: string;
      artifacts?: Array<{ path: string; kind: string }>;
    }
  | { type: "error"; message: string; code: string; correlationId: string };

type Subscription = {
  options: CodexStreamOptions;
  onData: (event: RawCodexStreamEvent) => void;
  onError: (err: unknown) => void;
  onComplete: () => void;
  unsubscribed: boolean;
};

export function createCodexStreamTestHarness() {
  const subscriptions: Subscription[] = [];

  const harness = {
    subscribe(options: CodexStreamOptions) {
      const sub: Subscription = {
        options,
        onData: () => {},
        onError: () => {},
        onComplete: () => {},
        unsubscribed: false,
      };
      subscriptions.push(sub);
      return {
        unsubscribe: () => {
          sub.unsubscribed = true;
        },
      };
    },

    emitEvent(event: RawCodexStreamEvent, index = 0) {
      const sub = subscriptions[index];
      if (sub && !sub.unsubscribed) {
        sub.onData(event);
      }
    },

    emitError(error: Error, index = 0) {
      const sub = subscriptions[index];
      if (sub && !sub.unsubscribed) {
        sub.onError(error);
      }
    },

    complete(index = 0) {
      const sub = subscriptions[index];
      if (sub && !sub.unsubscribed) {
        sub.onComplete();
      }
    },

    getSubscriptions() {
      return subscriptions.map((s) => s.options);
    },

    getSubscription(index = 0) {
      return subscriptions[index];
    },

    reset() {
      subscriptions.length = 0;
    },
  };

  return harness;
}

export const mockThreadItems = {
  reasoning: {
    id: "r1",
    type: "reasoning" as const,
    text: "Analyzing the problem and considering solutions...",
  },
  agentMessage: {
    id: "am1",
    type: "agent_message" as const,
    text: "I will help you with that task.",
  },
  commandInProgress: {
    id: "c1",
    type: "command_execution" as const,
    command: "npm test",
    status: "in_progress" as const,
    aggregated_output: "",
  },
  commandCompleted: {
    id: "c2",
    type: "command_execution" as const,
    command: "npm test",
    status: "completed" as const,
    aggregated_output: "All tests passed\n42 specs, 0 failures",
    exit_code: 0,
  },
  commandFailed: {
    id: "c3",
    type: "command_execution" as const,
    command: "npm build",
    status: "failed" as const,
    aggregated_output: "Error: Module not found",
    exit_code: 1,
  },
  fileChange: {
    id: "f1",
    type: "file_change" as const,
    status: "completed" as const,
    changes: [
      { path: "/src/new-file.ts", kind: "add" as const },
      { path: "/src/old-file.ts", kind: "delete" as const },
      { path: "/src/modified.ts", kind: "update" as const },
    ],
  },
  mcpToolCall: {
    id: "t1",
    type: "mcp_tool_call" as const,
    server: "filesystem",
    tool: "read_file",
    arguments: { path: "/src/index.ts" },
    status: "completed" as const,
    result: {
      content: [{ type: "text", text: "file contents" }],
      structured_content: null,
    },
  },
  mcpToolCallFailed: {
    id: "t2",
    type: "mcp_tool_call" as const,
    server: "github",
    tool: "list_repos",
    arguments: { owner: "test" },
    status: "failed" as const,
    error: { message: "Rate limited" },
  },
  webSearch: {
    id: "ws1",
    type: "web_search" as const,
    query: "bun test framework documentation",
  },
  todoList: {
    id: "td1",
    type: "todo_list" as const,
    items: [
      { text: "Write tests", completed: true },
      { text: "Review PR", completed: false },
      { text: "Deploy", completed: false },
    ],
  },
  error: {
    id: "e1",
    type: "error" as const,
    message: "Something went wrong during execution",
  },
} satisfies Record<string, ThreadItem>;

export const mockThreadEvents = {
  threadStarted: {
    type: "thread.started" as const,
    thread_id: "thread-123",
  },
  turnStarted: {
    type: "turn.started" as const,
  },
  turnCompleted: {
    type: "turn.completed" as const,
    usage: {
      input_tokens: 100,
      cached_input_tokens: 50,
      output_tokens: 200,
    },
  },
  turnFailed: {
    type: "turn.failed" as const,
    error: { message: "Model error" },
  },
  itemStarted: (item: ThreadItem) => ({
    type: "item.started" as const,
    item,
  }),
  itemUpdated: (item: ThreadItem) => ({
    type: "item.updated" as const,
    item,
  }),
  itemCompleted: (item: ThreadItem) => ({
    type: "item.completed" as const,
    item,
  }),
  error: {
    type: "error" as const,
    message: "Stream error occurred",
  },
} satisfies Record<string, ThreadEvent | ((item: ThreadItem) => ThreadEvent)>;

export function installTestHarness(
  harness: ReturnType<typeof createCodexStreamTestHarness>
) {
  globalThis.__codexStreamTestHarness__ = harness;
}

export function uninstallTestHarness() {
  globalThis.__codexStreamTestHarness__ = undefined;
}
