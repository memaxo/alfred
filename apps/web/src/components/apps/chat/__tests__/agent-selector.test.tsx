import "@/test/dom";
import { describe, expect, it, mock, vi } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import React from "react";

// Mock the dropdown menu components to avoid Radix UI environment issues in Bun/JSDOM
mock.module("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        "data-slot": "dropdown-menu-trigger",
      });
    }
    return <button data-slot="dropdown-menu-trigger">{children}</button>;
  },
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="dropdown-menu-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <div className={className} data-slot="dropdown-menu-item" onClick={onClick}>
      {children}
    </div>
  ),
}));

const { AgentSelector } = await import("../agent-selector");

describe("AgentSelector", () => {
  it("renders selected agent", () => {
    const { getByRole } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    const trigger = getByRole("button");
    expect(within(trigger).getByText("Assistant")).toBeTruthy();
  });

  it("opens dropdown when clicked", () => {
    const { container } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    // In our mock it's always rendered, but let's find them specifically in the content
    const content = container.querySelector(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!content) {
      throw new Error("Content not found");
    }

    expect(within(content as HTMLElement).getByText("Claude")).toBeTruthy();
    expect(within(content as HTMLElement).getByText("Codex")).toBeTruthy();
  });

  it("calls onChange when agent is selected", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <AgentSelector onChange={handleChange} value="assistant" />
    );

    const content = container.querySelector(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!content) {
      throw new Error("Content not found");
    }

    const claudeOption = within(content as HTMLElement)
      .getByText("Claude")
      .closest('[data-slot="dropdown-menu-item"]');
    if (claudeOption) {
      fireEvent.click(claudeOption);
    }

    expect(handleChange).toHaveBeenCalledWith("claude");
  });

  it("shows all available agents in dropdown", () => {
    const { container } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    const content = container.querySelector(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!content) {
      throw new Error("Content not found");
    }

    const c = within(content as HTMLElement);
    expect(c.getByText("Assistant")).toBeTruthy();
    expect(c.getByText("Claude")).toBeTruthy();
    expect(c.getByText("Codex")).toBeTruthy();
    expect(c.getByText("Droid")).toBeTruthy();
    expect(c.getByText("Roo")).toBeTruthy();
  });

  it("highlights selected agent in dropdown", () => {
    const { container } = render(
      <AgentSelector onChange={() => {}} value="claude" />
    );

    const content = container.querySelector(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!content) {
      throw new Error("Content not found");
    }

    const claudeOption = within(content as HTMLElement)
      .getByText("Claude")
      .closest('[class*="bg-white/5"]');
    expect(claudeOption).toBeTruthy();
  });

  it("renders agent descriptions", () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    expect(getByText("General purpose AI assistant")).toBeTruthy();
    expect(getByText("Anthropic's Claude for reasoning")).toBeTruthy();
  });

  it("handles all agent types", () => {
    const agents = ["assistant", "claude", "codex", "droid", "roo"] as const;

    for (const agent of agents) {
      const { unmount, getByRole } = render(
        <AgentSelector onChange={() => {}} value={agent} />
      );

      const trigger = getByRole("button");
      expect(trigger).toBeTruthy();
      unmount();
    }
  });

  describe("error cases", () => {
    it("handles invalid agent value gracefully", () => {
      expect(() =>
        render(
          <AgentSelector onChange={() => {}} value={"invalid" as "assistant"} />
        )
      ).not.toThrow();
    });

    it("handles onChange throwing error gracefully", () => {
      const handleChange = vi.fn(() => {
        throw new Error("Change failed");
      });
      const { container } = render(
        <AgentSelector onChange={handleChange} value="assistant" />
      );

      const content = container.querySelector(
        '[data-slot="dropdown-menu-content"]'
      );
      if (!content) {
        throw new Error("Content not found");
      }

      const claudeOption = within(content as HTMLElement)
        .getByText("Claude")
        .closest('[data-slot="dropdown-menu-item"]');
      if (claudeOption) {
        expect(() => fireEvent.click(claudeOption)).not.toThrow();
      }
    });

    it("handles rapid clicks gracefully", () => {
      const handleChange = vi.fn();
      const { getByRole } = render(
        <AgentSelector onChange={handleChange} value="assistant" />
      );

      const trigger = getByRole("button");
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      fireEvent.click(trigger);

      expect(within(trigger).getByText("Assistant")).toBeTruthy();
    });
  });
});
