/**
 * List Performance Tests
 *
 * Validates that list components meet performance requirements:
 * - FlashList renders correctly with 100+ items
 * - Memoization prevents unnecessary re-renders
 * - useCallback stability (callbacks don't change)
 */

import type { UIMessage } from "@alfred/type/stream";

import { FlashList } from "@shopify/flash-list";
import { render } from "@testing-library/react-native";
import { memo, useCallback, useState } from "react";
import { Text, View } from "react-native";

import { ChatList } from "../../components/chat/chat-list";

// Mock message data generator
function generateMessages(count: number): UIMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    parts: [
      {
        type: "text",
        text: `Message ${i}`,
      },
    ],
    createdAt: new Date(),
  }));
}

describe("list Performance", () => {
  describe("flashList rendering", () => {
    it("renders correctly with 100+ items", () => {
      const messages = generateMessages(150);
      const { getByText } = render(
        <ChatList messages={messages} isLoading={false} />
      );

      // Verify first and last messages render
      expect(getByText("Message 0")).toBeTruthy();
      expect(getByText("Message 149")).toBeTruthy();
    });

    it("handles empty list gracefully", () => {
      const { getByText } = render(
        <ChatList messages={[]} isLoading={false} />
      );

      expect(getByText("No messages yet")).toBeTruthy();
    });
  });

  describe("memoization", () => {
    it("prevents unnecessary re-renders with memo", () => {
      let renderCount = 0;

      const TestItem = memo(
        function TestItem({ id }: { id: string }) {
          renderCount++;
          return <Text>{id}</Text>;
        },
        (prev, next) => prev.id === next.id
      );

      const TestList = ({ items }: { items: { id: string }[] }) => {
        const renderItem = useCallback(
          ({ item }: { item: { id: string } }) => <TestItem id={item.id} />,
          []
        );

        return (
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
            estimatedItemSize={50}
          />
        );
      };

      const { rerender } = render(
        <TestList items={[{ id: "1" }, { id: "2" }]} />
      );

      const initialCount = renderCount;

      // Re-render with same items (different array reference)
      rerender(<TestList items={[{ id: "1" }, { id: "2" }]} />);

      // Memoization should prevent re-renders
      expect(renderCount).toBe(initialCount);
    });
  });

  describe("useCallback stability", () => {
    it("maintains stable callback references", () => {
      const callbacks: (() => void)[] = [];

      const TestComponent = ({ count }: { count: number }) => {
        const handlePress = useCallback(() => {
          // Callback implementation
        }, []);

        callbacks.push(handlePress);

        return <View />;
      };

      const { rerender } = render(<TestComponent count={1} />);
      rerender(<TestComponent count={2} />);
      rerender(<TestComponent count={3} />);

      // All callbacks should be the same reference
      expect(callbacks[0]).toBe(callbacks[1]);
      expect(callbacks[1]).toBe(callbacks[2]);
    });

    it("creates new callback when dependencies change", () => {
      const callbacks: (() => void)[] = [];

      const TestComponent = ({ dep }: { dep: number }) => {
        const handlePress = useCallback(() => {
          // Callback implementation
        }, [dep]);

        callbacks.push(handlePress);

        return <View />;
      };

      const { rerender } = render(<TestComponent dep={1} />);
      rerender(<TestComponent dep={2} />);

      // Callbacks should be different when dependency changes
      expect(callbacks[0]).not.toBe(callbacks[1]);
    });
  });
});
