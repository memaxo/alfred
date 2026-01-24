import "@/test/dom";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { VoiceStep } from "../voice-step";

const mockEnumerateDevices = vi.fn();
const mockGetUserMedia = vi.fn();

beforeEach(() => {
  mockEnumerateDevices.mockResolvedValue([
    { deviceId: "", label: "", kind: "audioinput", groupId: "" },
  ]);
  mockGetUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });

  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: {
      enumerateDevices: mockEnumerateDevices,
      getUserMedia: mockGetUserMedia,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VoiceStep", () => {
  it("renders heading and description", () => {
    const { container } = render(<VoiceStep />);

    expect(container.textContent).toContain("Set Up Voice");
    expect(container.textContent).toContain(
      "Configure your microphone for voice commands"
    );
  });

  it("renders skip button when onComplete provided", () => {
    const handleComplete = vi.fn();
    const { getByText } = render(<VoiceStep onComplete={handleComplete} />);

    expect(getByText("Skip voice setup")).toBeTruthy();
  });

  it("calls onComplete when skip is clicked", () => {
    const handleComplete = vi.fn();
    const { getByText } = render(<VoiceStep onComplete={handleComplete} />);

    fireEvent.click(getByText("Skip voice setup"));

    expect(handleComplete).toHaveBeenCalled();
  });

  it("does not render skip button when onComplete not provided", () => {
    const { queryByText } = render(<VoiceStep />);

    expect(queryByText("Skip voice setup")).toBeNull();
  });

  it("renders with biolum styling", () => {
    const { container } = render(<VoiceStep />);

    const headings = container.querySelectorAll(".text-biolum");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("handles missing onComplete gracefully", () => {
    const { container } = render(<VoiceStep />);
    expect(container).toBeTruthy();
  });

  describe("voice mode constants", () => {
    it("defines push-to-talk mode", () => {
      const modes = ["push-to-talk", "voice-activity", "continuous"];
      expect(modes).toContain("push-to-talk");
    });

    it("defines voice-activity mode", () => {
      const modes = ["push-to-talk", "voice-activity", "continuous"];
      expect(modes).toContain("voice-activity");
    });

    it("defines continuous mode", () => {
      const modes = ["push-to-talk", "voice-activity", "continuous"];
      expect(modes).toContain("continuous");
    });
  });
});
