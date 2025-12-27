import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AutonomySlider } from "../autonomy-slider";

describe("AutonomySlider", () => {
  it("renders with correct labels and description", () => {
    render(<AutonomySlider onChange={() => {}} value="low" />);

    expect(screen.getByText("Autonomy Level")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(
      screen.getByText("Suggestions only, no execution")
    ).toBeInTheDocument();

    // Check all levels are present in the bottom labels
    expect(screen.getByText("Read Only")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("calls onChange when slider value changes", () => {
    const handleChange = vi.fn();
    render(<AutonomySlider onChange={handleChange} value="low" />);

    const slider = screen.getByLabelText("Autonomy Level") as HTMLInputElement;

    // Change to "high" (index 3)
    fireEvent.change(slider, { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith("high");
  });

  it("updates labels when value prop changes", () => {
    const { rerender } = render(
      <AutonomySlider onChange={() => {}} value="read" />
    );
    expect(screen.getByText("Read Only")).toBeInTheDocument();
    expect(
      screen.getByText("No execution, read-only access")
    ).toBeInTheDocument();

    rerender(<AutonomySlider onChange={() => {}} value="high" />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(
      screen.getByText("Full execution with supervision")
    ).toBeInTheDocument();
  });

  it("disables input when disabled prop is true", () => {
    render(<AutonomySlider disabled onChange={() => {}} value="medium" />);
    const slider = screen.getByLabelText("Autonomy Level") as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });
});
