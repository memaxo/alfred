import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "bun:test";

import type { TerminalProfile } from "@/store/terminal";

import { ProfileDialog } from "../profile-dialog";

describe("ProfileDialog", () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnClose.mockClear();
  });

  describe("Create Mode", () => {
    it("renders with empty name field", () => {
      const { getByPlaceholderText } = render(
        <ProfileDialog onClose={mockOnClose} onSave={mockOnSave} />
      );

      const nameInput = getByPlaceholderText(
        "Profile name"
      ) as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });

    it("renders New Profile title", () => {
      const { getByText } = render(
        <ProfileDialog onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(getByText("New Profile")).toBeDefined();
    });

    it("renders type selection buttons", () => {
      const { getByText } = render(
        <ProfileDialog onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(getByText("Local Shell")).toBeDefined();
      expect(getByText("SSH Connection")).toBeDefined();
      expect(getByText("Docker Container")).toBeDefined();
    });

    it("calls onClose when Cancel clicked", () => {
      const { getByText } = render(
        <ProfileDialog onClose={mockOnClose} onSave={mockOnSave} />
      );

      fireEvent.click(getByText("Cancel"));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Edit Mode", () => {
    const existingProfile: TerminalProfile = {
      id: "existing-1",
      name: "Existing Profile",
      type: "ssh",
      host: "old.server.com",
      port: 22,
      username: "olduser",
    };

    it("renders Edit Profile title", () => {
      const { getByText } = render(
        <ProfileDialog
          onClose={mockOnClose}
          onSave={mockOnSave}
          profile={existingProfile}
        />
      );

      expect(getByText("Edit Profile")).toBeDefined();
    });

    it("shows Save button instead of Create", () => {
      const { getByText, queryByText } = render(
        <ProfileDialog
          onClose={mockOnClose}
          onSave={mockOnSave}
          profile={existingProfile}
        />
      );

      expect(getByText("Save")).toBeDefined();
      expect(queryByText("Create")).toBeNull();
    });

    it("populates name field with existing value", () => {
      const { getByDisplayValue } = render(
        <ProfileDialog
          onClose={mockOnClose}
          onSave={mockOnSave}
          profile={existingProfile}
        />
      );

      expect(getByDisplayValue("Existing Profile")).toBeDefined();
    });

    it("populates SSH fields with existing values", () => {
      const { getByDisplayValue } = render(
        <ProfileDialog
          onClose={mockOnClose}
          onSave={mockOnSave}
          profile={existingProfile}
        />
      );

      expect(getByDisplayValue("old.server.com")).toBeDefined();
      expect(getByDisplayValue("olduser")).toBeDefined();
    });

    it("calls onSave when Save clicked", () => {
      const { getByText } = render(
        <ProfileDialog
          onClose={mockOnClose}
          onSave={mockOnSave}
          profile={existingProfile}
        />
      );

      fireEvent.click(getByText("Save"));
      expect(mockOnSave).toHaveBeenCalled();
    });
  });
});
