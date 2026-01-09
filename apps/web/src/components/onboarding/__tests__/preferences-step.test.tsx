import "@/test/dom";
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { PreferencesStep } from "../preferences-step";

afterEach(() => {
  cleanup();
});

describe("PreferencesStep", () => {
  it("renders heading and description", () => {
    const { container } = render(
      <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
    );

    expect(container.textContent).toContain("Set Your Preferences");
    expect(container.textContent).toContain("Configure how ALFRED operates");
  });

  it("renders autonomy slider component", () => {
    const { getByLabelText } = render(
      <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
    );

    expect(getByLabelText("Autonomy Level")).toBeTruthy();
  });

  it("displays current autonomy level", () => {
    const { container } = render(
      <PreferencesStep autonomy="medium" onAutonomyChange={() => {}} />
    );

    expect(container.textContent).toContain("Medium");
  });

  it("slider accepts value changes", () => {
    const { getByLabelText } = render(
      <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
    );

    const slider = getByLabelText("Autonomy Level") as HTMLInputElement;
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("3");
  });

  it("renders autonomy level explanations", () => {
    const { container } = render(
      <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
    );

    expect(container.textContent).toContain("Read-only:");
    expect(container.textContent).toContain("Low:");
    expect(container.textContent).toContain("Medium:");
    expect(container.textContent).toContain("High:");
  });

  it("updates display when autonomy prop changes", () => {
    const { rerender, container } = render(
      <PreferencesStep autonomy="read" onAutonomyChange={() => {}} />
    );

    expect(container.textContent).toContain("Read Only");

    rerender(<PreferencesStep autonomy="high" onAutonomyChange={() => {}} />);
    expect(container.textContent).toContain("High");
  });

  describe("autonomy levels", () => {
    it("handles read autonomy level", () => {
      const { container } = render(
        <PreferencesStep autonomy="read" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("Read Only");
    });

    it("handles low autonomy level", () => {
      const { container } = render(
        <PreferencesStep autonomy="low" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("Low");
    });

    it("handles medium autonomy level", () => {
      const { container } = render(
        <PreferencesStep autonomy="medium" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("Medium");
    });

    it("handles high autonomy level", () => {
      const { container } = render(
        <PreferencesStep autonomy="high" onAutonomyChange={() => {}} />
      );
      expect(container.textContent).toContain("High");
    });
  });
});
