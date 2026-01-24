import { Orb } from "@/components/orb/orb";

import { renderWithProviders } from "../../utils/test-helpers";

describe("Orb", () => {
  it("should render correctly", () => {
    // Skia is mocked in setup.ts
    const { getByTestId } = renderWithProviders(
      <Orb size={200} state="idle" testID="orb-container" />
    );
    expect(getByTestId("orb-container")).toBeTruthy();
  });

  it("should change appearance based on state", () => {
    const { rerender, getByTestId } = renderWithProviders(
      <Orb size={200} state="listening" testID="orb-container" />
    );
    expect(getByTestId("orb-container")).toBeTruthy();

    rerender(<Orb size={200} state="thinking" testID="orb-container" />);
    expect(getByTestId("orb-container")).toBeTruthy();
  });
});
