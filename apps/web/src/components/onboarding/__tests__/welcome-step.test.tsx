import "@/test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { WelcomeStep } from "../welcome-step";

describe("WelcomeStep", () => {
  it("renders welcome heading and description", () => {
    const { getByText } = render(<WelcomeStep />);

    expect(getByText("Welcome to ALFRED")).toBeTruthy();
    expect(
      getByText(/Your personal AI assistant for workflow automation/i)
    ).toBeTruthy();
  });

  it("renders all three feature cards", () => {
    const { getByText } = render(<WelcomeStep />);

    expect(getByText("AI-Powered Workflows")).toBeTruthy();
    expect(getByText("Intelligent Memory")).toBeTruthy();
    expect(getByText("Voice-First")).toBeTruthy();
  });

  it("renders feature descriptions", () => {
    const { getByText } = render(<WelcomeStep />);

    expect(getByText(/Execute complex multi-step workflows/i)).toBeTruthy();
    expect(getByText(/Knowledge graph and semantic search/i)).toBeTruthy();
    expect(getByText(/Local voice models/i)).toBeTruthy();
  });

  it("renders with correct styling classes", () => {
    const { container } = render(<WelcomeStep />);

    const heading = container.querySelector("h1");
    expect(heading?.classList.contains("text-biolum")).toBe(true);

    const cards = container.querySelectorAll(".rounded-3xl");
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("renders icons for each feature", () => {
    const { container } = render(<WelcomeStep />);

    const iconContainers = container.querySelectorAll(
      ".rounded-full.bg-biolum\\/20"
    );
    expect(iconContainers.length).toBe(3);
  });
});
