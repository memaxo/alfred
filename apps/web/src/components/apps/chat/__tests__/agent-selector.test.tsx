import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { AgentSelector } from "../agent-selector";

describe("AgentSelector", () => {
  it("renders selected agent", () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    expect(getByText("Assistant")).toBeTruthy();
  });

  it("opens dropdown when clicked", async () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    const trigger = getByText("Assistant").closest("button");
    if (trigger) {
      fireEvent.click(trigger);
    }

    await waitFor(() => {
      expect(getByText("Claude")).toBeTruthy();
      expect(getByText("Codex")).toBeTruthy();
    });
  });

  it("calls onChange when agent is selected", async () => {
    const handleChange = vi.fn();
    const { getByText } = render(
      <AgentSelector onChange={handleChange} value="assistant" />
    );

    const trigger = getByText("Assistant").closest("button");
    if (trigger) {
      fireEvent.click(trigger);
    }

    await waitFor(() => {
      expect(getByText("Claude")).toBeTruthy();
    });

    const claudeOption = getByText("Claude").closest("div");
    if (claudeOption) {
      fireEvent.click(claudeOption);
    }

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("claude");
    });
  });

  it("shows all available agents in dropdown", async () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    const trigger = getByText("Assistant").closest("button");
    if (trigger) {
      fireEvent.click(trigger);
    }

    await waitFor(() => {
      expect(getByText("Assistant")).toBeTruthy();
      expect(getByText("Claude")).toBeTruthy();
      expect(getByText("Codex")).toBeTruthy();
      expect(getByText("Droid")).toBeTruthy();
      expect(getByText("Roo")).toBeTruthy();
    });
  });

  it("highlights selected agent in dropdown", async () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="claude" />
    );

    const trigger = getByText("Claude").closest("button");
    if (trigger) {
      fireEvent.click(trigger);
    }

    await waitFor(() => {
      const claudeOption = getByText("Claude").closest('[class*="bg-white/5"]');
      expect(claudeOption).toBeTruthy();
    });
  });

  it("renders agent descriptions", async () => {
    const { getByText } = render(
      <AgentSelector onChange={() => {}} value="assistant" />
    );

    const trigger = getByText("Assistant").closest("button");
    if (trigger) {
      fireEvent.click(trigger);
    }

    await waitFor(() => {
      expect(getByText("General purpose AI assistant")).toBeTruthy();
      expect(getByText("Anthropic's Claude for reasoning")).toBeTruthy();
    });
  });

  it("handles all agent types", async () => {
    const agents = ["assistant", "claude", "codex", "droid", "roo"] as const;

    for (const agent of agents) {
      const { unmount, getByRole } = render(
        <AgentSelector onChange={() => {}} value={agent} />
      );

      const trigger = getByRole("button");
      if (trigger) {
        fireEvent.click(trigger);
      }

      await waitFor(() => {
        expect(getByRole("menu")).toBeTruthy();
      });

      unmount();
    }
  });

  describe("error cases", () => {
    it("handles invalid agent value gracefully", () => {
      // TypeScript would prevent this, but runtime could have invalid value
      expect(() =>
        render(
          <AgentSelector onChange={() => {}} value={"invalid" as "assistant"} />
        )
      ).not.toThrow();
    });

    it("handles onChange throwing error gracefully", async () => {
      const handleChange = vi.fn(() => {
        throw new Error("Change failed");
      });
      const { getByText } = render(
        <AgentSelector onChange={handleChange} value="assistant" />
      );

      const trigger = getByText("Assistant").closest("button");
      if (trigger) {
        fireEvent.click(trigger);
      }

      await waitFor(() => {
        expect(getByText("Claude")).toBeTruthy();
      });

      const claudeOption = getByText("Claude").closest("div");
      if (claudeOption) {
        // Should not crash even if onChange throws
        expect(() => fireEvent.click(claudeOption)).not.toThrow();
      }
    });

    it("handles rapid clicks gracefully", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(
        <AgentSelector onChange={handleChange} value="assistant" />
      );

      const trigger = getByText("Assistant").closest("button");
      if (trigger) {
        fireEvent.click(trigger);
        fireEvent.click(trigger);
        fireEvent.click(trigger);
      }

      // Should not crash
      await waitFor(() => {
        expect(getByText("Claude")).toBeTruthy();
      });
    });
  });
});
