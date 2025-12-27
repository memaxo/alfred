import type { UIMessage } from "@alfred/type/stream";
import { useEffect, useRef } from "react";
import { FlatList, Text, View } from "react-native";
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
        <Text className="text-center text-lg text-muted-foreground">
          No messages yet. Ask Alfred anything!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={messages}
      keyExtractor={(item, index) => item.id ?? `msg-${index}`}
      onContentSizeChange={() =>
        flatListRef.current?.scrollToEnd({ animated: true })
      }
      ref={flatListRef}
      renderItem={({ item }) => <MessageBubble message={item} />}
    />
  );
}
