import { fireEvent } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

import { renderWithProviders } from "../utils/test-helpers";

// Mock expo-router
jest.mock<typeof import("expo-router")>(
  "expo-router",
  () =>
    ({
      useRouter: jest.fn(),
      useLocalSearchParams: jest.fn(),
      Stack: {
        Screen: ({ options: _options }: any) => null,
      },
    }) as unknown as typeof import("expo-router")
);

describe("navigation Integration", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useRouter)
      .mockReturnValue(mockRouter as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  });

  it("should navigate when button is pressed", () => {
    const TestComponent = () => {
      const router = useRouter();
      return (
        <View>
          <TouchableOpacity onPress={() => router.push("settings")}>
            <Text>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      );
    };

    const { getByText } = renderWithProviders(<TestComponent />);
    fireEvent.press(getByText("Go to Settings"));

    expect(mockRouter.push).toHaveBeenCalledWith("settings");
  });

  it("should handle route parameters", () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: "123" });

    const TestComponent = () => {
      const { id } = useLocalSearchParams<{ id: string }>();
      return <Text>Item ID: {id}</Text>;
    };

    const { getByText } = renderWithProviders(<TestComponent />);
    expect(getByText("Item ID: 123")).toBeTruthy();
  });
});
