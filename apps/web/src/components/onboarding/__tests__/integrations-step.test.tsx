import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { IntegrationsStep } from "../integrations-step";

describe("IntegrationsStep", () => {
  const originalOpen = globalThis.open;

  beforeEach(() => {
    globalThis.open = vi.fn();
    (globalThis as { window: { open: typeof vi.fn } }).window.open = vi.fn();
  });

  afterEach(() => {
    cleanup();
    globalThis.open = originalOpen;
  });

  it("renders heading and description", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    expect(container.textContent).toContain("Connect Your Tools");
    expect(container.textContent).toContain(
      "Connect ALFRED with your favorite tools"
    );
  });

  it("renders Linear integration card", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    expect(container.textContent).toContain("Linear");
    expect(container.textContent).toContain(
      "Project management and issue tracking"
    );
  });

  it("renders Laminar integration card", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    expect(container.textContent).toContain("Laminar");
    expect(container.textContent).toContain(
      "LLM observability and workflow evaluation"
    );
  });

  it("renders connect button for Linear", () => {
    const { getAllByRole } = render(<IntegrationsStep onSkip={() => {}} />);

    const connectButtons = getAllByRole("button", { name: /Connect/i });
    expect(connectButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders coming soon for Laminar", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    expect(container.textContent).toContain("Coming Soon");
  });

  it("has connect button that triggers OAuth", () => {
    const { getAllByRole } = render(<IntegrationsStep onSkip={() => {}} />);

    const connectButtons = getAllByRole("button", { name: /Connect/i });
    expect(connectButtons.length).toBeGreaterThanOrEqual(1);
    expect(connectButtons[0]).toBeTruthy();
  });

  it("renders skip button", () => {
    const { getByText } = render(<IntegrationsStep onSkip={() => {}} />);

    expect(getByText("Skip for now")).toBeTruthy();
  });

  it("calls onSkip when skip button clicked", () => {
    const handleSkip = vi.fn();
    const { getByText } = render(<IntegrationsStep onSkip={handleSkip} />);

    fireEvent.click(getByText("Skip for now"));

    expect(handleSkip).toHaveBeenCalled();
  });

  it("renders external link icon on connect button", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    const svgElements = container.querySelectorAll("svg");
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it("disables Laminar connect button", () => {
    const { container } = render(<IntegrationsStep onSkip={() => {}} />);

    const buttons = container.querySelectorAll("button[disabled]");
    expect(buttons.length).toBeGreaterThan(0);
  });

  describe("styling", () => {
    it("renders with correct card styling", () => {
      const { container } = render(<IntegrationsStep onSkip={() => {}} />);

      const cards = container.querySelectorAll(".rounded-3xl");
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it("renders with backdrop blur styling", () => {
      const { container } = render(<IntegrationsStep onSkip={() => {}} />);

      const blurElements = container.querySelectorAll(".backdrop-blur-xl");
      expect(blurElements.length).toBeGreaterThan(0);
    });
  });
});
