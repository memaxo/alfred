import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { cleanup, fireEvent, render } from "../../../test/testing-library";
import { OnboardingOverlay } from "../overlay";

// Mock the store
const setOnboardingCompleted = vi.fn();
mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: any) => {
    const state = {
      onboardingCompleted: false,
      setOnboardingCompleted,
    };
    return selector(state);
  },
}));

// Mock steps to avoid deep component rendering issues in this unit test
mock.module("../welcome-step", () => ({
  WelcomeStep: () => <div data-testid="welcome">Welcome</div>,
}));
mock.module("../voice-step", () => ({
  VoiceStep: () => <div data-testid="voice">Voice</div>,
}));
mock.module("../preferences-step", () => ({
  PreferencesStep: () => <div data-testid="preferences">Preferences</div>,
}));
mock.module("../integrations-step", () => ({
  IntegrationsStep: () => <div data-testid="integrations">Integrations</div>,
}));
mock.module("../tour-step", () => ({
  TourStep: () => <div data-testid="tour">Tour</div>,
}));

describe("OnboardingOverlay", () => {
  beforeEach(() => {
    setOnboardingCompleted.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the first step by default", () => {
    const { getByTestId } = render(<OnboardingOverlay />);
    expect(getByTestId("welcome")).toBeTruthy();
  });

  it("navigates through steps", async () => {
    const { getByRole, findByTestId } = render(<OnboardingOverlay />);

    // Step 1 -> 2
    fireEvent.click(getByRole("button", { name: /next/i }));
    expect(await findByTestId("voice")).toBeTruthy();

    // Step 2 -> 3
    fireEvent.click(getByRole("button", { name: /next/i }));
    expect(await findByTestId("preferences")).toBeTruthy();
  });

  it("calls setOnboardingCompleted on finish", () => {
    const { getByRole } = render(<OnboardingOverlay />);

    // Navigate to the end (5 steps total)
    fireEvent.click(getByRole("button", { name: /next/i })); // 2
    fireEvent.click(getByRole("button", { name: /next/i })); // 3
    fireEvent.click(getByRole("button", { name: /next/i })); // 4
    fireEvent.click(getByRole("button", { name: /next/i })); // 5

    fireEvent.click(getByRole("button", { name: /finish/i }));

    expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
  });

  it("skips onboarding when requested", () => {
    const { getByRole } = render(<OnboardingOverlay />);
    fireEvent.click(getByRole("button", { name: /skip for now/i }));
    expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
  });
});
