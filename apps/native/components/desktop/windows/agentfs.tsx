import { Text, View } from "react-native";

import type { WindowComponentProps } from "./types";

export function AgentfsWindow({ window }: WindowComponentProps) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="font-semibold text-foreground">AgentFS</Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Native AgentFS browser is not implemented yet.
      </Text>
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        Window id: {window.id}
      </Text>
    </View>
  );
}
