import { fireEvent } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

import { renderWithProviders } from "../utils/test-helpers";

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  Stack: {
    Screen: ({ options: _options }: any) => null,
  },
}));

describe("Navigation Integration", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
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
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "123" });

    const TestComponent = () => {
      const { id } = useLocalSearchParams<{ id: string }>();
      return <Text>Item ID: {id}</Text>;
    };

    const { getByText } = renderWithProviders(<TestComponent />);
    expect(getByText("Item ID: 123")).toBeTruthy();
  });
});
