import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { AutonomySlider } from "../autonomy-slider";

describe("AutonomySlider", () => {
  it("renders with correct labels and description", () => {
    const { getByText } = render(
      <AutonomySlider onChange={() => {}} value="low" />
    );

    expect(getByText("Autonomy Level")).toBeTruthy();
    expect(getByText("Low")).toBeTruthy();
    expect(getByText("Suggestions only, no execution")).toBeTruthy();

    // Check all levels are present in the bottom labels
    expect(getByText("Read Only")).toBeTruthy();
    expect(getByText("Medium")).toBeTruthy();
    expect(getByText("High")).toBeTruthy();
  });

  it("calls onChange when slider value changes", () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <AutonomySlider onChange={handleChange} value="low" />
    );

    const slider = getByLabelText("Autonomy Level") as HTMLInputElement;

    // Change to "high" (index 3)
    fireEvent.change(slider, { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith("high");
  });

  it("updates labels when value prop changes", () => {
    const { rerender, getByText } = render(
      <AutonomySlider onChange={() => {}} value="read" />
    );
    expect(getByText("Read Only")).toBeTruthy();
    expect(getByText("No execution, read-only access")).toBeTruthy();

    rerender(<AutonomySlider onChange={() => {}} value="high" />);
    expect(getByText("High")).toBeTruthy();
    expect(getByText("Full execution with supervision")).toBeTruthy();
  });

  it("disables input when disabled prop is true", () => {
    const { getByLabelText } = render(
      <AutonomySlider disabled onChange={() => {}} value="medium" />
    );
    const slider = getByLabelText("Autonomy Level") as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });

  describe("error cases and edge cases", () => {
    it("handles invalid value gracefully", () => {
      const { getByLabelText } = render(
        <AutonomySlider onChange={() => {}} value={"invalid" as "low"} />
      );
      const slider = getByLabelText("Autonomy Level") as HTMLInputElement;
      expect(slider).toBeTruthy();
    });

    it("calls onChange with correct value when slider changes", () => {
      const handleChange = vi.fn();
      const { getByLabelText } = render(
        <AutonomySlider onChange={handleChange} value="read" />
      );
      const slider = getByLabelText("Autonomy Level") as HTMLInputElement;

      // Verify initial value
      expect(slider.value).toBe("0");

      // Change to low (index 1)
      fireEvent.change(slider, { target: { value: "1" } });
      expect(handleChange).toHaveBeenCalledWith("low");
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("handles all level transitions", () => {
      const handleChange = vi.fn();
      const { getByLabelText, rerender } = render(
        <AutonomySlider onChange={handleChange} value="read" />
      );

      // Change from read (0) to low (1)
      fireEvent.change(getByLabelText("Autonomy Level") as HTMLInputElement, {
        target: { value: "1" },
      });
      expect(handleChange).toHaveBeenLastCalledWith("low");

      // Update component with new value and change to medium
      rerender(<AutonomySlider onChange={handleChange} value="low" />);
      fireEvent.change(getByLabelText("Autonomy Level") as HTMLInputElement, {
        target: { value: "2" },
      });
      expect(handleChange).toHaveBeenLastCalledWith("medium");

      // Update component with new value and change to high
      rerender(<AutonomySlider onChange={handleChange} value="medium" />);
      fireEvent.change(getByLabelText("Autonomy Level") as HTMLInputElement, {
        target: { value: "3" },
      });
      expect(handleChange).toHaveBeenLastCalledWith("high");
    });
  });
});
