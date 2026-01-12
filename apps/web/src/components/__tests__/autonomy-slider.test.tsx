import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { AutonomySlider } from "../autonomy-slider";

describe("AutonomySlider", () => {
  it("renders with correct labels and description", () => {
    const { getAllByText } = render(
      <AutonomySlider onChange={() => {}} value="low" />
    );

    expect(getAllByText("Autonomy Level").length).toBeGreaterThan(0);
    expect(getAllByText("Low").length).toBeGreaterThan(1); // One in header, one in scale
    expect(
      getAllByText("Suggestions only, no execution").length
    ).toBeGreaterThan(0);

    // Check all levels are present in the bottom labels
    expect(getAllByText("Read Only").length).toBeGreaterThan(0);
    expect(getAllByText("Medium").length).toBeGreaterThan(0);
    expect(getAllByText("High").length).toBeGreaterThan(0);
  });

  it("calls onChange when slider value changes", () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <AutonomySlider onChange={handleChange} value="low" />
    );

    const slider = getByLabelText("Autonomy Level") as HTMLInputElement;

    // Change to "high" (index 3)
    fireEvent.input(slider, { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith("high");
  });

  it("updates labels when value prop changes", () => {
    const { rerender, getAllByText } = render(
      <AutonomySlider onChange={() => {}} value="read" />
    );
    expect(getAllByText("Read Only").length).toBeGreaterThan(0);
    expect(
      getAllByText("No execution, read-only access").length
    ).toBeGreaterThan(0);

    rerender(<AutonomySlider onChange={() => {}} value="high" />);
    expect(getAllByText("High").length).toBeGreaterThan(0);
    expect(
      getAllByText("Full execution with supervision").length
    ).toBeGreaterThan(0);
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
      fireEvent.input(slider, { target: { value: "1" } });
      expect(handleChange).toHaveBeenCalledWith("low");
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("handles all level transitions", () => {
      const handleChange = vi.fn();
      const { getByLabelText, rerender } = render(
        <AutonomySlider onChange={handleChange} value="read" />
      );

      // Change from read (0) to low (1)
      const input = getByLabelText("Autonomy Level") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "1" } });
      expect(handleChange).toHaveBeenLastCalledWith("low");

      // Update component with new value and change to medium
      rerender(<AutonomySlider onChange={handleChange} value="low" />);
      const input2 = getByLabelText("Autonomy Level") as HTMLInputElement;
      fireEvent.input(input2, { target: { value: "2" } });
      expect(handleChange).toHaveBeenLastCalledWith("medium");

      // Update component with new value and change to high
      rerender(<AutonomySlider onChange={handleChange} value="medium" />);
      const input3 = getByLabelText("Autonomy Level") as HTMLInputElement;
      fireEvent.input(input3, { target: { value: "3" } });
      expect(handleChange).toHaveBeenLastCalledWith("high");
    });
  });
});
