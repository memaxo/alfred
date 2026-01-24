import { describe, expect, it } from "bun:test";

import {
  agentMessageItemSchema,
  commandExecutionItemSchema,
  errorItemSchema,
  fileChangeItemSchema,
  mcpToolCallItemSchema,
  parseThreadItem,
  reasoningItemSchema,
  threadItemSchema,
  todoListItemSchema,
  webSearchItemSchema,
} from "./items";

describe("reasoningItemSchema", () => {
  it("validates reasoning item", () => {
    const item = { id: "item-1", type: "reasoning", text: "Thinking..." };
    const result = reasoningItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("preserves passthrough fields", () => {
    const item = {
      id: "item-1",
      type: "reasoning",
      text: "Thinking...",
      extra: "data",
    };
    const result = reasoningItemSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra).toBe("data");
    }
  });

  it("rejects missing id", () => {
    const item = { type: "reasoning", text: "missing id" };
    const result = reasoningItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("agentMessageItemSchema", () => {
  it("validates agent message item", () => {
    const item = { id: "item-2", type: "agent_message", text: "Hello!" };
    const result = agentMessageItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("commandExecutionItemSchema", () => {
  it("validates command execution with string output", () => {
    const item = {
      id: "item-3",
      type: "command_execution",
      command: "npm test",
      aggregated_output: "All tests passed",
      exit_code: 0,
      status: "completed",
    };
    const result = commandExecutionItemSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aggregated_output).toBe("All tests passed");
    }
  });

  it("normalizes array output to string", () => {
    const item = {
      id: "item-3",
      type: "command_execution",
      command: "npm test",
      aggregated_output: ["line1", "line2", "line3"],
      status: "completed",
    };
    const result = commandExecutionItemSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aggregated_output).toBe("line1\nline2\nline3");
    }
  });

  it("handles undefined output", () => {
    const item = {
      id: "item-3",
      type: "command_execution",
      command: "npm test",
      status: "in_progress",
    };
    const result = commandExecutionItemSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aggregated_output).toBe("");
    }
  });

  it("rejects non-string array elements", () => {
    // The schema only accepts string | string[], not mixed arrays
    const item = {
      id: "item-3",
      type: "command_execution",
      command: "npm test",
      aggregated_output: ["line1", null, "line2"],
      status: "completed",
    };
    const result = commandExecutionItemSchema.safeParse(item);
    // Zod rejects arrays with non-string elements
    expect(result.success).toBe(false);
  });

  it("validates all status values", () => {
    for (const status of ["in_progress", "completed", "failed"]) {
      const item = {
        id: "item-3",
        type: "command_execution",
        command: "npm test",
        status,
      };
      const result = commandExecutionItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    }
  });
});

describe("fileChangeItemSchema", () => {
  it("validates file change item", () => {
    const item = {
      id: "item-4",
      type: "file_change",
      status: "completed",
      changes: [
        { path: "/src/new.ts", kind: "add" },
        { path: "/src/old.ts", kind: "delete" },
        { path: "/src/mod.ts", kind: "update" },
      ],
    };
    const result = fileChangeItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects empty changes array", () => {
    const item = {
      id: "item-4",
      type: "file_change",
      status: "completed",
      changes: [],
    };
    const result = fileChangeItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("rejects invalid change kind", () => {
    const item = {
      id: "item-4",
      type: "file_change",
      status: "completed",
      changes: [{ path: "/src/new.ts", kind: "create" }],
    };
    const result = fileChangeItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("mcpToolCallItemSchema", () => {
  it("validates mcp tool call item", () => {
    const item = {
      id: "item-5",
      type: "mcp_tool_call",
      server: "github",
      tool: "list_repos",
      arguments: { owner: "user" },
      status: "completed",
      result: {
        content: [{ type: "text", text: "repos list" }],
        structured_content: { repos: [] },
      },
    };
    const result = mcpToolCallItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("validates mcp tool call with error", () => {
    const item = {
      id: "item-5",
      type: "mcp_tool_call",
      server: "github",
      tool: "list_repos",
      arguments: {},
      status: "failed",
      error: { message: "Rate limited" },
    };
    const result = mcpToolCallItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("webSearchItemSchema", () => {
  it("validates web search item", () => {
    const item = {
      id: "item-6",
      type: "web_search",
      query: "bun test framework",
    };
    const result = webSearchItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("todoListItemSchema", () => {
  it("validates todo list item", () => {
    const item = {
      id: "item-7",
      type: "todo_list",
      items: [
        { text: "Write tests", completed: true },
        { text: "Review PR", completed: false },
      ],
    };
    const result = todoListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("allows empty todo list", () => {
    const item = { id: "item-7", type: "todo_list", items: [] };
    const result = todoListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("errorItemSchema", () => {
  it("validates error item", () => {
    const item = {
      id: "item-8",
      type: "error",
      message: "Something went wrong",
    };
    const result = errorItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("threadItemSchema", () => {
  it("accepts all valid item types", () => {
    const items = [
      { id: "1", type: "reasoning", text: "..." },
      { id: "2", type: "agent_message", text: "..." },
      {
        id: "3",
        type: "command_execution",
        command: "ls",
        status: "completed",
      },
      {
        id: "4",
        type: "file_change",
        status: "completed",
        changes: [{ path: "/a", kind: "add" }],
      },
      {
        id: "5",
        type: "mcp_tool_call",
        server: "s",
        tool: "t",
        arguments: {},
        status: "completed",
      },
      { id: "6", type: "web_search", query: "q" },
      { id: "7", type: "todo_list", items: [] },
      { id: "8", type: "error", message: "err" },
    ];

    for (const item of items) {
      const result = threadItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown item types", () => {
    const item = { id: "1", type: "unknown_type", data: {} };
    const result = threadItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("parseThreadItem", () => {
  it("parses valid item", () => {
    const item = { id: "1", type: "reasoning", text: "Thinking" };
    const result = parseThreadItem(item);
    expect(result).toEqual(item);
  });

  it("returns null for invalid item", () => {
    const item = { type: "invalid" };
    const result = parseThreadItem(item);
    expect(result).toBeNull();
  });

  it("returns null for null input", () => {
    const result = parseThreadItem(null);
    expect(result).toBeNull();
  });
});
