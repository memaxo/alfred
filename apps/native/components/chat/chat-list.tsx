import type { UIMessage } from "@alfred/type/stream";

import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { memo, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";

import { EmptyState } from "../utility/EmptyState";
import { MessageBubbleVoid } from "./MessageBubbleVoid";

export interface ChatListProps {
  messages: UIMessage[];
  isLoading?: boolean;
  streamingMessageId?: string | null;
}

// Memoized message item for performance
const MemoizedMessageBubble = memo(
  MessageBubbleVoid,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message === next.message &&
    prev.isStreaming === next.isStreaming
);

export function ChatList({
  messages,
  isLoading,
  streamingMessageId,
}: ChatListProps) {
  const listRef = useRef<FlashListRef<UIMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleContentSizeChange = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const keyExtractor = useCallback(
    (item: UIMessage, index: number) => item.id ?? `msg-${index}`,
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: UIMessage }) => (
      <MemoizedMessageBubble
        message={item}
        isStreaming={item.id === streamingMessageId}
      />
    ),
    [streamingMessageId]
  );

  if (messages.length === 0 && !isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="chatbubbles-outline"
          title="No messages yet"
          message="Ask Alfred anything!"
        />
      </View>
    );
  }

  return (
    <FlashList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={messages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onContentSizeChange={handleContentSizeChange}
      // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
      estimatedItemSize={80}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
});
