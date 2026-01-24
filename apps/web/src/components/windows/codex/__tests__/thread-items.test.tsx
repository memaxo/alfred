import "@/test/dom";
import type { ThreadItem } from "@alfred/protocol";

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { mockThreadItems } from "@/lib/codex/__tests__/test-harness";

import { ThreadItemList, ThreadItemView } from "../thread-items";

describe("ThreadItemView", () => {
  describe("ReasoningItemView", () => {
    it("renders reasoning icon and text", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.reasoning} />
      );
      expect(getByText(/Analyzing/)).toBeDefined();
    });

    it("shows collapsed preview by default for long text", () => {
      const longReasoning = {
        ...mockThreadItems.reasoning,
        text: "A".repeat(150),
      };
      const { getByText } = render(<ThreadItemView item={longReasoning} />);
      const text = getByText(/A+/);
      expect(text.textContent?.length).toBeLessThan(150);
    });

    it("expands full text on click", () => {
      const longReasoning = {
        ...mockThreadItems.reasoning,
        text: "A".repeat(150),
      };
      const { getByRole, getByText } = render(
        <ThreadItemView item={longReasoning} />
      );

      const button = getByRole("button");
      fireEvent.click(button);

      const container = getByText(/A+/);
      expect(container.textContent?.length).toBeGreaterThanOrEqual(150);
    });
  });

  describe("AgentMessageItemView", () => {
    it("renders message text", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.agentMessage} />
      );
      expect(getByText(/help you with that task/)).toBeDefined();
    });
  });

  describe("CommandExecutionItemView", () => {
    it("renders command text", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.commandCompleted} />
      );
      expect(getByText(/npm test/)).toBeDefined();
    });

    it("shows exit code when present", () => {
      const { getByRole, getByText } = render(
        <ThreadItemView item={mockThreadItems.commandCompleted} />
      );
      const button = getByRole("button");
      fireEvent.click(button);
      expect(getByText(/Exit code: 0/)).toBeDefined();
    });

    it("expands to show aggregated output", () => {
      const { getByRole, getByText } = render(
        <ThreadItemView item={mockThreadItems.commandCompleted} />
      );
      const button = getByRole("button");
      fireEvent.click(button);
      expect(getByText(/All tests passed/)).toBeDefined();
    });
  });

  describe("FileChangeItemView", () => {
    it("renders file changes list", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.fileChange} />
      );
      expect(getByText(/new-file.ts/)).toBeDefined();
      expect(getByText(/old-file.ts/)).toBeDefined();
      expect(getByText(/modified.ts/)).toBeDefined();
    });

    it("shows File Changes header", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.fileChange} />
      );
      expect(getByText("File Changes")).toBeDefined();
    });
  });

  describe("McpToolCallItemView", () => {
    it("renders server and tool name", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.mcpToolCall} />
      );
      expect(getByText(/filesystem/)).toBeDefined();
      expect(getByText(/read_file/)).toBeDefined();
    });

    it("expands to show arguments", () => {
      const { getByRole, getByText } = render(
        <ThreadItemView item={mockThreadItems.mcpToolCall} />
      );
      const button = getByRole("button");
      fireEvent.click(button);
      expect(getByText(/Arguments/)).toBeDefined();
      expect(getByText(/index.ts/)).toBeDefined();
    });

    it("shows error message when present", () => {
      const { getByRole, getByText } = render(
        <ThreadItemView item={mockThreadItems.mcpToolCallFailed} />
      );
      const button = getByRole("button");
      fireEvent.click(button);
      expect(getByText(/Rate limited/)).toBeDefined();
    });
  });

  describe("WebSearchItemView", () => {
    it("renders search query", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.webSearch} />
      );
      expect(getByText(/bun test framework/)).toBeDefined();
    });
  });

  describe("TodoListItemView", () => {
    it("renders todo items", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.todoList} />
      );
      expect(getByText("Write tests")).toBeDefined();
      expect(getByText("Review PR")).toBeDefined();
      expect(getByText("Deploy")).toBeDefined();
    });

    it("shows checkboxes for items", () => {
      const { getAllByRole } = render(
        <ThreadItemView item={mockThreadItems.todoList} />
      );
      const checkboxes = getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    });
  });

  describe("ErrorItemView", () => {
    it("renders error message", () => {
      const { getByText } = render(
        <ThreadItemView item={mockThreadItems.error} />
      );
      expect(getByText(/Something went wrong/)).toBeDefined();
    });
  });
});

describe("ThreadItemList", () => {
  it("renders empty state when no items", () => {
    const { getByText } = render(<ThreadItemList items={[]} />);
    expect(getByText(/No activity yet/)).toBeDefined();
  });

  it("renders all item types", () => {
    const items: ThreadItem[] = [
      mockThreadItems.reasoning,
      mockThreadItems.commandCompleted,
      mockThreadItems.fileChange,
    ];
    const { getByText } = render(<ThreadItemList items={items} />);

    expect(getByText(/Analyzing/)).toBeDefined();
    expect(getByText(/npm test/)).toBeDefined();
    expect(getByText(/File Changes/)).toBeDefined();
  });

  it("preserves item order", () => {
    const items: ThreadItem[] = [
      { ...mockThreadItems.reasoning, id: "first", text: "First item" },
      { ...mockThreadItems.reasoning, id: "second", text: "Second item" },
      { ...mockThreadItems.reasoning, id: "third", text: "Third item" },
    ];
    const { getAllByText } = render(<ThreadItemList items={items} />);

    const texts = getAllByText(/item$/);
    expect(texts[0].textContent).toContain("First");
    expect(texts[1].textContent).toContain("Second");
    expect(texts[2].textContent).toContain("Third");
  });
});
