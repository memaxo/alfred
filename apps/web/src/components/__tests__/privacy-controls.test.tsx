import "@/test/dom";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import { PrivacyControls } from "../privacy-controls";

describe("PrivacyControls", () => {
  it("renders export and forget sections", () => {
    const { getByText, getByRole } = render(<PrivacyControls />);

    expect(getByText("Privacy Controls")).toBeTruthy();
    expect(getByText("Data Export")).toBeTruthy();
    expect(getByText("Data Deletion")).toBeTruthy();
    expect(getByRole("button", { name: /Export Data/i })).toBeTruthy();
    expect(getByRole("button", { name: /Delete All Data/i })).toBeTruthy();
  });

  it("calls onExport when export button clicked", () => {
    const handleExport = vi.fn();
    const { getByRole } = render(<PrivacyControls onExport={handleExport} />);

    fireEvent.click(getByRole("button", { name: /Export Data/i }));
    expect(handleExport).toHaveBeenCalled();
  });

  it("requires confirmation for forget (delete) action", () => {
    const handleForget = vi.fn();
    const { getByRole, getByText, queryByText } = render(
      <PrivacyControls onForget={handleForget} />
    );

    const deleteButton = getByRole("button", {
      name: /Delete All Data/i,
    });
    fireEvent.click(deleteButton);

    // Should show confirmation message and new buttons
    expect(getByText(/Are you sure\?/i)).toBeTruthy();
    expect(getByRole("button", { name: /Confirm Delete/i })).toBeTruthy();
    expect(getByRole("button", { name: /Cancel/i })).toBeTruthy();
    expect(handleForget).not.toHaveBeenCalled();

    // Clicking cancel should revert to initial state
    fireEvent.click(getByRole("button", { name: /Cancel/i }));
    expect(queryByText(/Are you sure\?/i)).toBeNull();
    expect(getByRole("button", { name: /Delete All Data/i })).toBeTruthy();
  });

  it("calls onForget when deletion is confirmed", () => {
    const handleForget = vi.fn();
    const { getByRole } = render(<PrivacyControls onForget={handleForget} />);

    fireEvent.click(getByRole("button", { name: /Delete All Data/i }));
    fireEvent.click(getByRole("button", { name: /Confirm Delete/i }));

    expect(handleForget).toHaveBeenCalled();
  });

  it("respects disabled props", () => {
    const { getByRole } = render(
      <PrivacyControls exportDisabled forgetDisabled />
    );

    const exportButton = getByRole("button", {
      name: /Export Data/i,
    }) as HTMLButtonElement;
    const deleteButton = getByRole("button", {
      name: /Delete All Data/i,
    }) as HTMLButtonElement;

    expect(exportButton.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
  });

  describe("error cases", () => {
    it("handles export failure gracefully", () => {
      const handleExport = vi.fn(() => {
        throw new Error("Export failed");
      });
      const { getByRole } = render(<PrivacyControls onExport={handleExport} />);

      fireEvent.click(getByRole("button", { name: /Export Data/i }));

      expect(handleExport).toHaveBeenCalled();
      // Component should not crash
      expect(getByRole("button", { name: /Export Data/i })).toBeTruthy();
    });

    it("handles delete failure gracefully", () => {
      const handleForget = vi.fn(() => {
        throw new Error("Delete failed");
      });
      const { getByRole } = render(<PrivacyControls onForget={handleForget} />);

      fireEvent.click(getByRole("button", { name: /Delete All Data/i }));
      fireEvent.click(getByRole("button", { name: /Confirm Delete/i }));

      expect(handleForget).toHaveBeenCalled();
      // Component should not crash
      expect(getByRole("button", { name: /Delete All Data/i })).toBeTruthy();
    });

    it("prevents multiple rapid confirmations", () => {
      const handleForget = vi.fn();
      const { getByRole } = render(<PrivacyControls onForget={handleForget} />);

      const deleteButton = getByRole("button", {
        name: /Delete All Data/i,
      });
      fireEvent.click(deleteButton);

      const confirmButton = getByRole("button", {
        name: /Confirm Delete/i,
      });
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      // Should only be called once
      expect(handleForget).toHaveBeenCalledTimes(1);
    });

    it("handles missing callbacks gracefully", () => {
      const { getByRole } = render(<PrivacyControls />);

      // Should render without crashing
      expect(getByRole("button", { name: /Export Data/i })).toBeTruthy();
      expect(getByRole("button", { name: /Delete All Data/i })).toBeTruthy();
    });
  });
});
