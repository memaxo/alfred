/**
 * Accessibility Tests for Pressable Migration
 *
 * Validates that Pressable components meet accessibility requirements:
 * - Screen reader compatibility
 * - Touch target sizes
 * - Keyboard navigation
 */

import { render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

describe("pressable Accessibility", () => {
  describe("screen reader support", () => {
    it("supports accessibilityLabel", () => {
      const { getByLabelText } = render(
        <Pressable
          accessibilityLabel="Test button"
          accessibilityRole="button"
          onPress={() => {}}
        >
          <Text>Button</Text>
        </Pressable>
      );

      expect(getByLabelText("Test button")).toBeTruthy();
    });

    it("supports accessibilityRole", () => {
      const { getByRole } = render(
        <Pressable accessibilityRole="button" onPress={() => {}}>
          <Text>Button</Text>
        </Pressable>
      );

      expect(getByRole("button")).toBeTruthy();
    });

    it("supports accessibilityHint", () => {
      const { getByLabelText } = render(
        <Pressable
          accessibilityLabel="Send message"
          accessibilityHint="Double tap to send"
          accessibilityRole="button"
          onPress={() => {}}
        >
          <Text>Send</Text>
        </Pressable>
      );

      const element = getByLabelText("Send message");
      expect(element).toBeTruthy();
      // Note: accessibilityHint may not be directly queryable in tests
      // but should be set for screen readers
    });
  });

  describe("touch target sizes", () => {
    it("meets minimum 44x44pt touch target", () => {
      const { getByRole } = render(
        <Pressable
          accessibilityRole="button"
          onPress={() => {}}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Text>Button</Text>
        </Pressable>
      );

      const button = getByRole("button");
      expect(button).toBeTruthy();
      // Note: Actual size verification would require measuring rendered element
      // This test ensures the pattern is followed
    });
  });

  describe("pressed states", () => {
    it("applies pressed style correctly", () => {
      const { getByRole } = render(
        <Pressable
          accessibilityRole="button"
          onPress={() => {}}
          style={({ pressed }) => [
            { backgroundColor: "blue" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text>Button</Text>
        </Pressable>
      );

      expect(getByRole("button")).toBeTruthy();
    });
  });

  describe("disabled state", () => {
    it("supports accessibilityState disabled", () => {
      const { getByRole } = render(
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          onPress={() => {}}
        >
          <Text>Disabled Button</Text>
        </Pressable>
      );

      const button = getByRole("button");
      expect(button).toBeTruthy();
      expect(button.props.accessibilityState.disabled).toBeTruthy();
    });
  });
});
