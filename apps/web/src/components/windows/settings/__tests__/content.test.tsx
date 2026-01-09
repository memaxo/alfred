/**
 * Tests for SettingsContent component
 *
 * Tests the unified settings UI used in both route and window contexts.
 */

import "@/test/dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  createToastMock,
  createTrpcMock,
  mockState,
  mockVoices,
  resetMockState,
} from "./mocks";

// Apply mocks before importing component
mock.module("sonner", () => createToastMock());
mock.module("@/utils/trpc", () => createTrpcMock());

import { SettingsContent } from "../content";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SettingsContent", () => {
  beforeEach(() => {
    resetMockState();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Full Mode", () => {
    it("renders navigation links in full mode with onNavigate", () => {
      const onNavigate = vi.fn();
      const { getByText } = render(
        <SettingsContent mode="full" onNavigate={onNavigate} />,
        { wrapper: createWrapper() }
      );

      expect(getByText("Profile")).toBeTruthy();
      expect(getByText("Visual Appearance")).toBeTruthy();
      expect(getByText("Privacy")).toBeTruthy();
    });

    it("calls onNavigate when clicking navigation links", () => {
      const onNavigate = vi.fn();
      const { getByText } = render(
        <SettingsContent mode="full" onNavigate={onNavigate} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(getByText("Profile"));
      expect(onNavigate).toHaveBeenCalledWith("/settings/profile");

      fireEvent.click(getByText("Visual Appearance"));
      expect(onNavigate).toHaveBeenCalledWith("/settings/visual");

      fireEvent.click(getByText("Privacy"));
      expect(onNavigate).toHaveBeenCalledWith("/settings/privacy");
    });

    it("hides navigation links without onNavigate", () => {
      const { queryByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(queryByText("Profile")).toBeNull();
      expect(queryByText("Visual Appearance")).toBeNull();
      expect(queryByText("Privacy")).toBeNull();
    });

    it("shows voice preview input in full mode", () => {
      const { getByPlaceholderText, getByText } = render(
        <SettingsContent mode="full" />,
        { wrapper: createWrapper() }
      );

      expect(getByPlaceholderText("Type something to preview...")).toBeTruthy();
      expect(getByText("Preview")).toBeTruthy();
    });

    it("displays all voice options in full mode", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      for (const voice of mockVoices) {
        expect(getByText(voice.name)).toBeTruthy();
      }
    });
  });

  describe("Compact Mode", () => {
    it("hides navigation links in compact mode", () => {
      const onNavigate = vi.fn();
      const { queryByText } = render(
        <SettingsContent mode="compact" onNavigate={onNavigate} />,
        { wrapper: createWrapper() }
      );

      expect(queryByText("Profile")).toBeNull();
      expect(queryByText("Visual Appearance")).toBeNull();
      expect(queryByText("Privacy")).toBeNull();
    });

    it("hides voice preview in compact mode", () => {
      const { queryByPlaceholderText, queryByText } = render(
        <SettingsContent mode="compact" />,
        { wrapper: createWrapper() }
      );

      expect(queryByPlaceholderText("Type something to preview...")).toBeNull();
      expect(queryByText("Preview")).toBeNull();
    });

    it("limits voice options in compact mode", () => {
      const { queryByText, getByText } = render(
        <SettingsContent mode="compact" />,
        { wrapper: createWrapper() }
      );

      expect(getByText("Alfred Classic")).toBeTruthy();
      expect(getByText("Alfred Modern")).toBeTruthy();
      expect(getByText("Alfred Soft")).toBeTruthy();
      expect(getByText("Alfred Deep")).toBeTruthy();
      expect(queryByText("Alfred Light")).toBeNull();
    });
  });

  describe("Autonomy Section", () => {
    it("renders autonomy slider", () => {
      const { getByRole, container } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const sectionTitles = container.querySelectorAll("h3");
      const autonomyTitle = Array.from(sectionTitles).find((h) =>
        h.textContent?.includes("Autonomy")
      );
      expect(autonomyTitle).toBeTruthy();
      expect(getByRole("slider")).toBeTruthy();
    });

    it("slider can be interacted with", () => {
      const { getByRole } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const slider = getByRole("slider") as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "3" } });
      expect(slider).toBeTruthy();
    });
  });

  describe("Voice Section", () => {
    it("renders voice section title", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(getByText("Voice")).toBeTruthy();
    });

    it("renders voice description in full mode", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(
        getByText(
          "Choose the voice Alfred uses for speech-to-speech responses."
        )
      ).toBeTruthy();
    });

    it("voice cards are clickable", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const voiceCard = getByText("Alfred Modern").closest("div");
      expect(voiceCard).toBeTruthy();
      fireEvent.click(getByText("Alfred Modern"));
    });

    it("preview button exists", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const previewButton = getByText("Preview").closest("button");
      expect(previewButton).toBeTruthy();
      fireEvent.click(getByText("Preview"));
    });

    it("preview input accepts text", () => {
      const { getByPlaceholderText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const input = getByPlaceholderText(
        "Type something to preview..."
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Custom text" } });
      expect(input.value).toBe("Custom text");
    });
  });

  describe("Preferences Section", () => {
    it("renders preferences section", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(getByText("Custom Preferences")).toBeTruthy();
    });

    it("displays preference count", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(getByText("Saved (4)")).toBeTruthy();
    });

    it("renders existing preferences excluding autonomy in list", () => {
      const { container } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const prefKeys = container.querySelectorAll("li .font-medium");
      const keyTexts = Array.from(prefKeys).map((el) => el.textContent);
      expect(keyTexts).toContain("theme");
      expect(keyTexts).toContain("notifications");
      expect(keyTexts).toContain("customKey");
      expect(keyTexts).not.toContain("autonomy");
    });

    it("has input fields for custom preference", () => {
      const { getByPlaceholderText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(getByPlaceholderText("key (e.g. theme)")).toBeTruthy();
      expect(getByPlaceholderText("value (string or JSON)")).toBeTruthy();
    });

    it("has save button", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(getByText("Save")).toBeTruthy();
    });

    it("has delete buttons for each preference", () => {
      const { container } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const prefItems = container.querySelectorAll("li");
      const deleteButtons = Array.from(prefItems).map((li) =>
        li.querySelector("button")
      );
      expect(deleteButtons.filter(Boolean).length).toBe(3);
    });
  });

  describe("Validation", () => {
    it("shows error when saving with empty key", () => {
      resetMockState();
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(getByText("Save"));

      expect(mockState.toastErrorMessage).toBe("Preference key required");
    });

    it("input fields accept text", () => {
      const { getByPlaceholderText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const keyInput = getByPlaceholderText(
        "key (e.g. theme)"
      ) as HTMLInputElement;
      const valueInput = getByPlaceholderText(
        "value (string or JSON)"
      ) as HTMLTextAreaElement;

      fireEvent.change(keyInput, { target: { value: "testKey" } });
      fireEvent.change(valueInput, { target: { value: "testValue" } });

      expect(keyInput.value).toBe("testKey");
      expect(valueInput.value).toBe("testValue");
    });

    it("save button is clickable", () => {
      const { getByText } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const saveButton = getByText("Save").closest("button");
      expect(saveButton).toBeTruthy();
      expect(saveButton?.disabled).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("displays boolean preference values", () => {
      const { container } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      const prefItems = container.querySelectorAll("li");
      const boolRow = Array.from(prefItems).find((li) =>
        li.textContent?.includes("notifications")
      );
      expect(boolRow?.textContent).toContain("true");
    });

    it("displays string preference values", () => {
      const { container } = render(<SettingsContent mode="full" />, {
        wrapper: createWrapper(),
      });

      expect(container.textContent).toContain("customKey");
      expect(container.textContent).toContain("customValue");
    });

    it("applies custom className", () => {
      const { container } = render(
        <SettingsContent className="custom-class" mode="full" />,
        { wrapper: createWrapper() }
      );

      const wrapper = container.querySelector(".custom-class");
      expect(wrapper).toBeTruthy();
    });

    it("defaults to full mode when mode not specified", () => {
      const { getByPlaceholderText } = render(<SettingsContent />, {
        wrapper: createWrapper(),
      });

      expect(getByPlaceholderText("Type something to preview...")).toBeTruthy();
    });
  });
});
