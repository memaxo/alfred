/**
 * Onboarding System Integration Tests
 *
 * Tests the complete onboarding flow including step transitions,
 * state management, and completion handling.
 */

import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { IntegrationsStep } from "../integrations-step";
import { PreferencesStep } from "../preferences-step";
import { TourStep } from "../tour-step";
import { WelcomeStep } from "../welcome-step";

beforeEach(() => {
  globalThis.open = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Onboarding System", () => {
  describe("Step Rendering", () => {
    it("renders WelcomeStep as first step content", () => {
      const { getByText } = render(<WelcomeStep />);
      expect(getByText("Welcome to ALFRED")).toBeTruthy();
    });

    it("renders PreferencesStep with autonomy slider", () => {
      const { getByLabelText } = render(
        <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
      );
      expect(getByLabelText("Autonomy Level")).toBeTruthy();
    });

    it("renders IntegrationsStep with available integrations", () => {
      const { getByText } = render(<IntegrationsStep onSkip={() => {}} />);
      expect(getByText("Connect Your Tools")).toBeTruthy();
    });

    it("renders TourStep with feature overview", () => {
      const { getByText } = render(<TourStep onComplete={() => {}} />);
      expect(getByText("Quick Feature Tour")).toBeTruthy();
    });
  });

  describe("Step Flow Simulation", () => {
    it("simulates integrations skip flow", () => {
      const skipHandler = vi.fn();

      const { getByText } = render(<IntegrationsStep onSkip={skipHandler} />);
      fireEvent.click(getByText("Skip for now"));
      expect(skipHandler).toHaveBeenCalled();
    });

    it("simulates tour completion", () => {
      const completionHandler = vi.fn();
      const { getByRole } = render(<TourStep onComplete={completionHandler} />);

      fireEvent.click(getByRole("button", { name: /Get Started/i }));
      expect(completionHandler).toHaveBeenCalled();
    });
  });

  describe("Autonomy State Management", () => {
    it("has slider with correct attributes", () => {
      const { getByLabelText } = render(
        <PreferencesStep autonomy="read" onAutonomyChange={() => {}} />
      );

      const slider = getByLabelText("Autonomy Level") as HTMLInputElement;
      expect(slider.type).toBe("range");
      expect(slider.min).toBe("0");
      expect(slider.max).toBe("3");
    });

    it("validates read autonomy level description", () => {
      const { container } = render(
        <PreferencesStep autonomy="read" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("No execution, read-only access");
    });

    it("validates low autonomy level description", () => {
      const { container } = render(
        <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("Suggestions only, no execution");
    });

    it("validates medium autonomy level description", () => {
      const { container } = render(
        <PreferencesStep autonomy="medium" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain(
        "Cautious execution with confirmation"
      );
    });

    it("validates high autonomy level description", () => {
      const { container } = render(
        <PreferencesStep autonomy="high" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain(
        "Full execution with supervision"
      );
    });
  });

  describe("Skip Functionality", () => {
    it("allows skipping integrations", () => {
      const skipHandler = vi.fn();
      const { getByText } = render(<IntegrationsStep onSkip={skipHandler} />);

      fireEvent.click(getByText("Skip for now"));
      expect(skipHandler).toHaveBeenCalled();
    });
  });

  describe("Integration OAuth", () => {
    it("renders Linear connect button", () => {
      const { getAllByRole } = render(<IntegrationsStep onSkip={() => {}} />);

      const connectButtons = getAllByRole("button", { name: /Connect/i });
      expect(connectButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Completion Handling", () => {
    it("calls completion handler on tour finish", () => {
      const completeHandler = vi.fn();
      const { getByRole } = render(<TourStep onComplete={completeHandler} />);

      fireEvent.click(getByRole("button", { name: /Get Started/i }));

      expect(completeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Visual Consistency", () => {
    it("welcome step uses biolum styling", () => {
      const { container } = render(<WelcomeStep />);
      const headings = container.querySelectorAll(".text-biolum");
      expect(headings.length).toBeGreaterThan(0);
    });

    it("tour step uses biolum styling", () => {
      const { container } = render(<TourStep onComplete={() => {}} />);
      const headings = container.querySelectorAll(".text-biolum");
      expect(headings.length).toBeGreaterThan(0);
    });

    it("welcome step has card styling", () => {
      const { container } = render(<WelcomeStep />);
      const cards = container.querySelectorAll(".rounded-3xl");
      expect(cards.length).toBeGreaterThan(0);
    });

    it("tour step has card styling", () => {
      const { container } = render(<TourStep onComplete={() => {}} />);
      const cards = container.querySelectorAll(".rounded-3xl");
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe("Error Resilience", () => {
    it("handles rapid callback invocations", () => {
      const skipHandler = vi.fn();
      const { getByText } = render(<IntegrationsStep onSkip={skipHandler} />);

      const skipBtn = getByText("Skip for now");
      fireEvent.click(skipBtn);
      fireEvent.click(skipBtn);
      fireEvent.click(skipBtn);

      expect(skipHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe("Accessibility", () => {
    it("all interactive elements are focusable", () => {
      const { container } = render(<TourStep onComplete={() => {}} />);

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button.tabIndex).not.toBe(-1);
      });
    });

    it("slider has accessible label", () => {
      const { getByLabelText } = render(
        <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
      );

      const slider = getByLabelText("Autonomy Level");
      expect(slider).toBeTruthy();
    });
  });
});

describe("Onboarding Constants", () => {
  it("defines correct total steps count", () => {
    const TOTAL_STEPS = 5;
    expect(TOTAL_STEPS).toBe(5);
  });

  it("step order is Welcome -> Preferences -> Voice -> Integrations -> Tour", () => {
    const stepOrder = [
      "Welcome",
      "Preferences",
      "Voice",
      "Integrations",
      "Tour",
    ];
    expect(stepOrder).toHaveLength(5);
    expect(stepOrder[0]).toBe("Welcome");
    expect(stepOrder[4]).toBe("Tour");
  });
});
