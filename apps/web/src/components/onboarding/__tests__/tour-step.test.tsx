import "@/test/dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { TourStep } from "../tour-step";

afterEach(() => {
  cleanup();
});

describe("TourStep", () => {
  it("renders heading and description", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    expect(container.textContent).toContain("Quick Feature Tour");
    expect(container.textContent).toContain(
      "Here's what you can do with ALFRED"
    );
  });

  it("renders chat interface feature", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    expect(container.textContent).toContain("Chat Interface");
    expect(container.textContent).toContain(
      "Talk to ALFRED using text or voice"
    );
  });

  it("renders workflow automation feature", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    expect(container.textContent).toContain("Workflow Automation");
    expect(container.textContent).toContain(
      "Execute complex multi-step workflows"
    );
  });

  it("renders personal management feature", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    expect(container.textContent).toContain("Personal Management");
    expect(container.textContent).toContain("Manage notes, reminders, timers");
  });

  it("renders customization feature", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    expect(container.textContent).toContain("Customization");
    expect(container.textContent).toContain(
      "Adjust autonomy levels, privacy settings"
    );
  });

  it("renders get started button", () => {
    const { getByRole } = render(<TourStep onComplete={() => {}} />);

    expect(getByRole("button", { name: /Get Started/i })).toBeTruthy();
  });

  it("calls onComplete when get started clicked", () => {
    const handleComplete = vi.fn();
    const { getByRole } = render(<TourStep onComplete={handleComplete} />);

    fireEvent.click(getByRole("button", { name: /Get Started/i }));

    expect(handleComplete).toHaveBeenCalled();
  });

  it("renders feature icons", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    const iconContainers = container.querySelectorAll(
      ".rounded-full.bg-biolum\\/20"
    );
    expect(iconContainers.length).toBe(4);
  });

  it("renders check icon in get started button", () => {
    const { container } = render(<TourStep onComplete={() => {}} />);

    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  describe("feature cards", () => {
    it("renders all four feature cards", () => {
      const { container } = render(<TourStep onComplete={() => {}} />);

      const cards = container.querySelectorAll(".flex.items-start.gap-4");
      expect(cards.length).toBe(4);
    });

    it("cards have correct styling", () => {
      const { container } = render(<TourStep onComplete={() => {}} />);

      const cards = container.querySelectorAll(".rounded-3xl.border");
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("accessibility", () => {
    it("button is focusable", () => {
      const { getByRole } = render(<TourStep onComplete={() => {}} />);

      const button = getByRole("button", { name: /Get Started/i });
      expect(button.tabIndex).not.toBe(-1);
    });
  });
});
