/**
 * Editor Tabs Component Tests
 */

import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import type { FileTab } from "../types";

const { EditorTabs } = await import("../editor-tabs");

const createTabs = (count: number): FileTab[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `tab-${i + 1}`,
    name: `file${i + 1}.ts`,
    path: `/src/file${i + 1}.ts`,
    language: "typescript",
    content: `// file ${i + 1}`,
    isDirty: i === 1,
  }));

describe("EditorTabs", () => {
  describe("rendering", () => {
    it("renders nothing when tabs array is empty", () => {
      const { container } = render(
        <EditorTabs
          activeId={null}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={[]}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders all tabs", () => {
      const tabs = createTabs(3);
      const { getByText } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      expect(getByText("file1.ts")).toBeDefined();
      expect(getByText("file2.ts")).toBeDefined();
      expect(getByText("file3.ts")).toBeDefined();
    });

    it("shows dirty indicator for dirty tabs", () => {
      const tabs = createTabs(2);
      const { container } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const dirtyIndicators = container.querySelectorAll(
        ".rounded-full.bg-biolum"
      );
      expect(dirtyIndicators.length).toBe(1);
    });

    it("highlights the active tab", () => {
      const tabs = createTabs(2);
      const { getByText } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const activeTabButton = getByText("file1.ts");
      const tabContainer = activeTabButton.closest("div");
      expect(tabContainer?.className).toContain("bg-void-surface");
    });
  });

  describe("interactions", () => {
    it("calls onSelect when tab is clicked", () => {
      const tabs = createTabs(2);
      const onSelect = vi.fn();
      const { getByText } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onSelect={onSelect}
          tabs={tabs}
        />
      );
      fireEvent.click(getByText("file2.ts"));
      expect(onSelect).toHaveBeenCalledWith("tab-2");
    });

    it("calls onClose when close button is clicked", () => {
      const tabs = createTabs(2);
      const onClose = vi.fn();
      const { container } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={onClose}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const closeButtons = container.querySelectorAll('button[type="button"]');
      const firstCloseButton = closeButtons[1];
      if (firstCloseButton) {
        fireEvent.click(firstCloseButton);
        expect(onClose).toHaveBeenCalledWith("tab-1");
      }
    });
  });

  describe("drag and drop", () => {
    it("sets draggable attribute on tabs", () => {
      const tabs = createTabs(2);
      const { container } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onReorder={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const draggableElements =
        container.querySelectorAll("[draggable='true']");
      expect(draggableElements.length).toBe(2);
    });

    it("applies visual feedback during drag", () => {
      const tabs = createTabs(2);
      const { container } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onReorder={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const draggableElements =
        container.querySelectorAll("[draggable='true']");
      const firstTab = draggableElements[0]!;
      fireEvent.dragStart(firstTab, {
        dataTransfer: { effectAllowed: "move", setData: vi.fn() },
      });
      expect(firstTab.className).toContain("opacity-50");
    });
  });

  describe("accessibility", () => {
    it("all tab names are buttons", () => {
      const tabs = createTabs(2);
      const { container } = render(
        <EditorTabs
          activeId="tab-1"
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const buttons = container.querySelectorAll('button[type="button"]');
      expect(buttons.length).toBe(4); // 2 name buttons + 2 close buttons
    });

    it("truncates long file names", () => {
      const tabs: FileTab[] = [
        {
          id: "1",
          name: "very-long-file-name-that-should-be-truncated.ts",
          path: "/src/very-long-file-name-that-should-be-truncated.ts",
          language: "typescript",
          content: "",
          isDirty: false,
        },
      ];
      const { getByText } = render(
        <EditorTabs
          activeId="1"
          onClose={vi.fn()}
          onSelect={vi.fn()}
          tabs={tabs}
        />
      );
      const nameButton = getByText(
        "very-long-file-name-that-should-be-truncated.ts"
      );
      expect(nameButton.className).toContain("truncate");
    });
  });
});
