import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { PrivacyControls } from "../privacy-controls";

describe("PrivacyControls", () => {
  it("renders export and forget sections", () => {
    render(<PrivacyControls />);

    expect(screen.getByText("Privacy Controls")).toBeInTheDocument();
    expect(screen.getByText("Data Export")).toBeInTheDocument();
    expect(screen.getByText("Data Deletion")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Export Data/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete All Data/i })
    ).toBeInTheDocument();
  });

  it("calls onExport when export button clicked", () => {
    const handleExport = vi.fn();
    render(<PrivacyControls onExport={handleExport} />);

    fireEvent.click(screen.getByRole("button", { name: /Export Data/i }));
    expect(handleExport).toHaveBeenCalled();
  });

  it("requires confirmation for forget (delete) action", () => {
    const handleForget = vi.fn();
    render(<PrivacyControls onForget={handleForget} />);

    const deleteButton = screen.getByRole("button", {
      name: /Delete All Data/i,
    });
    fireEvent.click(deleteButton);

    // Should show confirmation message and new buttons
    expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm Delete/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(handleForget).not.toHaveBeenCalled();

    // Clicking cancel should revert to initial state
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByText(/Are you sure\?/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /Delete All Data/i })
    ).toBeInTheDocument();
  });

  it("calls onForget when deletion is confirmed", () => {
    const handleForget = vi.fn();
    render(<PrivacyControls onForget={handleForget} />);

    fireEvent.click(screen.getByRole("button", { name: /Delete All Data/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Delete/i }));

    expect(handleForget).toHaveBeenCalled();
  });

  it("respects disabled props", () => {
    render(<PrivacyControls exportDisabled forgetDisabled />);

    const exportButton = screen.getByRole("button", {
      name: /Export Data/i,
    }) as HTMLButtonElement;
    const deleteButton = screen.getByRole("button", {
      name: /Delete All Data/i,
    }) as HTMLButtonElement;

    expect(exportButton.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
  });
});
