import type { UIMessage } from "@alfred/type/stream";
import { useRef, useEffect } from "react";
import { FlatList, View, Text } from "react-native";
import { MessageBubble } from "./message-bubble";

export type ChatListProps = {
  messages: UIMessage[];
  isLoading?: boolean;
};

export function ChatList({ messages, isLoading }: ChatListProps) {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground text-center text-lg">
          No messages yet. Ask Alfred anything!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item, index) => item.id ?? `msg-${index}`}
      renderItem={({ item }) => <MessageBubble message={item} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      className="flex-1"
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
    />
  );
}
